const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const SECRET_KEY = "migajas_pati_clave_secreta_2026";

// Base de datos temporal en memoria (Simulación)
const users = [];

// 1. Ruta para registrar cajeros/panaderos (Solo Admins)
app.post('/api/register', (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ message: "Faltan datos requeridos" });
    }

    // Encriptar la contraseña
    const hashedPassword = bcrypt.hashSync(password, 8);
    const newUser = { 
        id: users.length + 1, 
        username, 
        password: hashedPassword, 
        role // 'administrador' o 'usuario' (cajero)
    };

    users.push(newUser);
    res.status(201).json({ message: "Usuario registrado con éxito", userId: newUser.id });
});

// 2. Ruta de Login (Genera el Token JWT)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ message: "Credenciales inválidas" });
    }

    // Generar Token codificando el ID y el Rol
    const token = jwt.sign(
        { id: user.id, role: user.role }, 
        SECRET_KEY, 
        { expiresIn: '8h' }
    );

    res.json({ token, role: user.role, message: "Inicio de sesión exitoso" });
});

// Exportamos la app para las pruebas
module.exports = app;

// Si se ejecuta directamente, inicia el servidor en el puerto 3000
if (require.main === module) {
    app.listen(3000, () => {
        console.log('Servidor corriendo en http://localhost:3000');
    });
}