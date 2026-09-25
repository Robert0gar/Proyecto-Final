const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

const SECRET_KEY = "migajas_pati_clave_secreta_2026";

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==========================================
// 📦 RUTAS DE PRODUCTOS (CRUD COMPLETO)
// ==========================================

// READ: Obtener catálogo de productos
app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
});

// READ: Obtener un producto por ID
app.get('/api/products/:id', (req, res) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ message: "Producto no encontrado." });
    res.json(product);
});

// CREATE: Crear nuevo producto
app.post('/api/products', (req, res) => {
    const { name, price, stock, category } = req.body;
    if (!name || price === undefined || stock === undefined) {
        return res.status(400).json({ message: "Nombre, precio y stock son requeridos." });
    }

    try {
        const stmt = db.prepare('INSERT INTO products (name, price, stock, category) VALUES (?, ?, ?, ?)');
        const result = stmt.run(name, parseFloat(price), parseInt(stock), category || 'Pan dulce');
        res.status(201).json({ message: "Producto creado exitosamente.", id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ message: "Error al crear producto: " + err.message });
    }
});

// UPDATE: Editar / Actualizar producto existente
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { name, price, stock, category } = req.body;

    try {
        const stmt = db.prepare('UPDATE products SET name = ?, price = ?, stock = ?, category = ? WHERE id = ?');
        const result = stmt.run(name, parseFloat(price), parseInt(stock), category, id);
        
        if (result.changes === 0) {
            return res.status(404).json({ message: "Producto no encontrado." });
        }
        res.json({ message: "Producto actualizado correctamente." });
    } catch (err) {
        res.status(500).json({ message: "Error al actualizar producto: " + err.message });
    }
});

// DELETE: Eliminar producto
app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM products WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes === 0) {
            return res.status(404).json({ message: "Producto no encontrado." });
        }
        res.json({ message: "Producto eliminado correctamente." });
    } catch (err) {
        res.status(500).json({ message: "Error al eliminar producto: " + err.message });
    }
});

// POST /api/products/refill - Surtir / Rellenar stock de un pan existente
app.post('/api/products/refill', (req, res) => {
    const { productId, stock } = req.body;
    
    if (!productId || stock === undefined || parseInt(stock) <= 0) {
        return res.status(400).json({ message: "Por favor selecciona un pan y una cantidad válida mayor a 0." });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!prod) {
        return res.status(404).json({ message: "El producto seleccionado no existe." });
    }

    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(parseInt(stock), productId);
    res.json({ message: `Se agregaron ${stock} unidades a "${prod.name}". Nuevo stock: ${prod.stock + parseInt(stock)}` });
});

// ==========================================
// 🔐 AUTENTICACIÓN
// ==========================================

// POST /api/login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, role: user.role, username: user.username, message: "Inicio de sesión exitoso" });
});

// ==========================================
// 🛒 VENTAS Y CORTE DE CAJA
// ==========================================

// POST /api/sales - Registrar venta y descontar stock
app.post('/api/sales', (req, res) => {
    const { items, total, cashier } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ message: "La venta debe incluir productos" });
    }

    const processTransaction = db.transaction(() => {
        for (const item of items) {
            const prod = db.prepare('SELECT stock FROM products WHERE name = ?').get(item.name);
            if (!prod || prod.stock < 1) {
                throw new Error(`Sin stock suficiente para: ${item.name}`);
            }
        }

        const createdAt = new Date().toLocaleString();
        const insertSale = db.prepare('INSERT INTO sales (total, cashier, created_at, day_closed) VALUES (?, ?, ?, 0)');
        const saleResult = insertSale.run(total, cashier || 'Desconocido', createdAt);
        const saleId = saleResult.lastInsertRowid;

        const insertItem = db.prepare('INSERT INTO sale_items (sale_id, product_name, price) VALUES (?, ?, ?)');
        const updateStock = db.prepare('UPDATE products SET stock = stock - 1 WHERE name = ?');

        for (const item of items) {
            insertItem.run(saleId, item.name, item.price);
            updateStock.run(item.name);
        }

        return saleId;
    });

    try {
        const saleId = processTransaction();
        res.status(201).json({ message: "Venta registrada e inventario descontado", saleId });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// GET /api/sales - Historial de ventas del día en curso
app.get('/api/sales', (req, res) => {
    const sales = db.prepare('SELECT * FROM sales WHERE day_closed = 0 ORDER BY id DESC').all();
    
    const detailedSales = sales.map(sale => {
        const items = db.prepare('SELECT product_name AS name, price FROM sale_items WHERE sale_id = ?').all(sale.id);
        return {
            id: sale.id,
            total: sale.total,
            cashier: sale.cashier,
            date: sale.created_at,
            items
        };
    });

    res.json({ sales: detailedSales });
});

// POST /api/sales/close-day - Finalizar jornada aunque no haya ventas
app.post('/api/sales/close-day', (req, res) => {
    const sales = db.prepare('SELECT * FROM sales WHERE day_closed = 0').all();

    let totalRevenue = 0;
    let productSummary = {};

    for (const sale of sales) {
        totalRevenue += sale.total;
        const items = db.prepare('SELECT product_name FROM sale_items WHERE sale_id = ?').all(sale.id);
        for (const item of items) {
            productSummary[item.product_name] = (productSummary[item.product_name] || 0) + 1;
        }
    }

    if (sales.length > 0) {
        db.prepare('UPDATE sales SET day_closed = 1 WHERE day_closed = 0').run();
    }

    res.json({
        message: "Día finalizado exitosamente",
        summary: {
            totalTickets: sales.length,
            totalRevenue,
            productSummary
        }
    });
});

// =========================================================
// 🚀 MERMAS, MATRIZ Y PREDICCIÓN DE PRODUCCIÓN (DSS)
// =========================================================

// POST /api/waste - Registrar merma de productos
app.post('/api/waste', (req, res) => {
    const { productId, quantity, reason } = req.body;

    if (!productId || !quantity || parseInt(quantity) <= 0) {
        return res.status(400).json({ message: "Selecciona un producto y una cantidad válida mayor a 0." });
    }

    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!prod) {
        return res.status(404).json({ message: "El producto seleccionado no existe." });
    }

    const qty = parseInt(quantity);

    const recordWaste = db.transaction(() => {
        db.prepare('INSERT INTO waste_logs (product_id, product_name, quantity, reason) VALUES (?, ?, ?, ?)').run(prod.id, prod.name, qty, reason || 'Dañado/Vencido');
        db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(qty, prod.id);
    });

    try {
        recordWaste();
        res.json({ message: `Se registraron ${qty} unidades mermadas de "${prod.name}".` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/reports/profitability-matrix - Matriz de Rentabilidad vs. Desperdicio
app.get('/api/reports/profitability-matrix', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products').all();
        let allSaleItems = [];
        let allWasteLogs = [];

        try { allSaleItems = db.prepare('SELECT * FROM sale_items').all(); } catch (e) {}
        try { allWasteLogs = db.prepare('SELECT * FROM waste_logs').all(); } catch (e) {}

        const matrix = products.map(prod => {
            const soldItems = allSaleItems.filter(item => 
                (item.product_name && item.product_name === prod.name) || 
                (item.product_id && item.product_id === prod.id)
            );
            const totalSold = soldItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

            const wasteItems = allWasteLogs.filter(w => w.product_id === prod.id);
            const totalWasted = wasteItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            let classification = 'Relleno';
            let badgeColor = '#ffc107'; // Amarillo
            let actionNote = 'Demanda estable. Mantener horneado habitual.';

            if (totalSold >= 8 && totalWasted <= 2) {
                classification = '⭐ Producto Estrella';
                badgeColor = '#28a745'; // Verde
                actionNote = 'Alta rotación y baja merma. Priorizar producción.';
            } else if (totalWasted > totalSold || (totalWasted >= 4 && totalSold <= 3)) {
                classification = '🚨 En Riesgo / Crítico';
                badgeColor = '#dc3545'; // Rojo
                actionNote = 'Mermas superan o igualan ventas. Reducir producción.';
            }

            return {
                id: prod.id,
                name: prod.name,
                category: prod.category || 'Panadería',
                total_sold: totalSold,
                total_wasted: totalWasted,
                classification: classification,
                badge_color: badgeColor,
                action_note: actionNote
            };
        });

        res.json({ success: true, matrix });
    } catch (err) {
        console.error('Error calculando matriz de rentabilidad:', err);
        res.status(500).json({ success: false, message: 'Error interno al generar matriz' });
    }
});

// GET /api/reports/production-recommendation - Sugerencias de horneado (DSS)
app.get('/api/reports/production-recommendation', (req, res) => {
    try {
        const products = db.prepare('SELECT * FROM products').all();

        if (!products || products.length === 0) {
            return res.json({ success: true, recommendations: [] });
        }

        let allSaleItems = [];
        try {
            allSaleItems = db.prepare('SELECT * FROM sale_items').all();
        } catch (e) {
            console.log('Tabla sale_items vacía o sin leer:', e.message);
        }

        let allWasteLogs = [];
        try {
            allWasteLogs = db.prepare('SELECT * FROM waste_logs').all();
        } catch (e) {
            console.log('Tabla waste_logs vacía o sin leer:', e.message);
        }

        let activeDays = 1;
        try {
            const daysRow = db.prepare('SELECT COUNT(DISTINCT DATE(created_at)) as days FROM sales').get();
            if (daysRow && daysRow.days > 0) activeDays = daysRow.days;
        } catch (e) {
            activeDays = 1;
        }

        const recommendations = products.map(prod => {
            const soldItems = allSaleItems.filter(item => 
                (item.product_name && item.product_name === prod.name) || 
                (item.product_id && item.product_id === prod.id)
            );

            const totalSold = soldItems.reduce((acc, curr) => acc + (curr.quantity || 1), 0);

            const wasteItems = allWasteLogs.filter(w => w.product_id === prod.id);
            const totalWasted = wasteItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

            const avgDailySales = parseFloat((totalSold / activeDays).toFixed(1));

            let recommendedBaking = 0;
            let status = 'Normal';
            let alertColor = '#28a745'; // Verde

            if (prod.stock <= 0) {
                status = '🔥 AGOTADO / Crítico';
                alertColor = '#dc3545'; // Rojo
                recommendedBaking = Math.max(totalSold, Math.ceil(avgDailySales * 1.2), 5);
            } else if (prod.stock <= 2) {
                status = '⚠️ Stock Bajo';
                alertColor = '#ffc107'; // Amarillo
                const target = Math.max(totalSold, Math.ceil(avgDailySales * 1.2), 6);
                recommendedBaking = Math.max(0, target - prod.stock);
            } else {
                const target = Math.max(totalSold, Math.ceil(avgDailySales));
                recommendedBaking = Math.max(0, target - prod.stock);
            }

            return {
                id: prod.id,
                name: prod.name,
                category: prod.category || 'Panadería',
                current_stock: prod.stock,
                total_sold: totalSold,
                total_wasted: totalWasted,
                avg_daily_sales: avgDailySales,
                recommended_baking: recommendedBaking,
                status: status,
                alert_color: alertColor
            };
        });

        res.json({ success: true, recommendations });
    } catch (err) {
        console.error('Error crítico al calcular recomendaciones:', err);
        res.status(500).json({ success: false, message: 'Error en el servidor al procesar predicciones' });
    }
});

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor corriendo en http://localhost:3000');
    });
}