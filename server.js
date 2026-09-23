const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

const SECRET_KEY = "migajas_pati_clave_secreta_2026";

// Base de datos simulada
const users = [
    { id: 1, username: "gerente", password: bcrypt.hashSync("admin123", 8), role: "administrador" },
    { id: 2, username: "cajero1", password: bcrypt.hashSync("pan123", 8), role: "usuario" },
    { id: 3, username: "cajero2", password: bcrypt.hashSync("pan123", 8), role: "usuario" }
];

// Arreglo para almacenar ventas
const salesHistory = [];

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registrar usuario
app.post('/api/register', (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: "Faltan datos requeridos" });

    const hashedPassword = bcrypt.hashSync(password, 8);
    const newUser = { id: users.length + 1, username, password: hashedPassword, role };
    users.push(newUser);
    res.status(201).json({ message: "Usuario registrado con éxito", userId: newUser.id });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, SECRET_KEY, { expiresIn: '8h' });
    res.json({ token, role: user.role, username: user.username, message: "Inicio de sesión exitoso" });
});

// Registrar una nueva venta (POST /api/sales)
app.post('/api/sales', (req, res) => {
    const { items, total, cashier } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ message: "La venta debe incluir productos" });
    }

    const newSale = {
        id: salesHistory.length + 1,
        items,
        total,
        cashier: cashier || 'Desconocido',
        date: new Date().toLocaleString()
    };

    salesHistory.push(newSale);
    res.status(201).json({ message: "Venta registrada con éxito", sale: newSale });
});

// Obtener reporte de ventas (GET /api/sales - Solo Admin)
app.get('/api/sales', (req, res) => {
    res.json({ sales: salesHistory });
});

module.exports = app;

if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor corriendo en http://localhost:3000');
    });
}