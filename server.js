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

// GET /api/products - Obtener catálogo de productos
app.get('/api/products', (req, res) => {
    const products = db.prepare('SELECT * FROM products').all();
    res.json(products);
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

    // Marcar las ventas abiertas como cerradas
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

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor corriendo en http://localhost:3000');
    });
}