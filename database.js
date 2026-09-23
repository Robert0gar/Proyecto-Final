const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'database.sqlite'));

// Crear Tablas
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        emoji TEXT NOT NULL,
        image TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 10
    );

    CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        total REAL NOT NULL,
        cashier TEXT NOT NULL,
        created_at TEXT NOT NULL,
        day_closed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_name TEXT NOT NULL,
        price REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales (id)
    );
`);

// Precargar Datos Iniciales con imágenes específicas
const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;

if (userCount === 0) {
    const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');
    insertUser.run('gerente', bcrypt.hashSync('admin123', 8), 'administrador');
    insertUser.run('cajero1', bcrypt.hashSync('pan123', 8), 'usuario');
    insertUser.run('cajero2', bcrypt.hashSync('pan123', 8), 'usuario');

    const insertProduct = db.prepare('INSERT INTO products (name, price, category, emoji, image, stock) VALUES (?, ?, ?, ?, ?, ?)');
    
    const initialProducts = [
        // Pan Dulce
        ['Concha Vainilla', 15.00, 'Pan Dulce', '🍞','/images/concha-vainilla.jpg' , 10],
        ['Concha Choco', 15.00, 'Pan Dulce', '🍞','/images/concha-chocolate.jpg' , 10],
        ['Croissant Mantequilla', 22.00, 'Pan Dulce', '🥐', '/images/croissant-mantequilla.webp', 10],
        ['Dona Chocolate', 18.00, 'Pan Dulce', '🍩', '/images/dona-chocolate.webp', 10],
        ['Dona Glaseada', 16.00, 'Pan Dulce', '🍩', '/images/dona-glaseada.webp', 10],
        ['Oreja de Hojaldre', 20.00, 'Pan Dulce', '🥐', '/images/oreja.webp', 10],
        ['Chocolatín', 26.00, 'Pan Dulce', '🍫', '/images/chocolatin.jpg', 10],
        ['Polvorón', 15.00, 'Pan Dulce', '🍪', '/images/polvoron.jpg', 10],
        ['Mantecada Nuez', 18.00, 'Pan Dulce', '🧁', '/images/mantecada-nuez.jpg', 10],
        ['Besito Mermelada', 17.00, 'Pan Dulce', '🍪', '/images/beso-mermelada.jpg', 10],
        ['Marranito', 24.00, 'Pan Dulce', '🥐', '/images/marranito.webp', 10],
        ['Tomate', 25.00, 'Pan Dulce', '🧁', '/images/tomate.jpg', 10],

        // Pan Blanco
        ['Bolillo Rústico', 7.00, 'Pan Blanco', '🥖','/images/bolillo.jpg' , 10],
        ['Telera', 8.00, 'Pan Blanco', '🥖', '/images/telera.jpg', 10],
        ['Baguette Artesanal', 28.00, 'Pan Blanco', '🥖', '/images/baguette.jpeg', 10],
        ['Pan Masamadre', 65.00, 'Pan Blanco', '🍞', '/images/pan-masamadre.jpg', 10],
        ['Pan Brioche', 25.00, 'Pan Blanco', '🍞', '/images/pan-brioche.webp', 10],

        // Repostería
        ['Pastel Tres Leches', 48.00, 'Repostería', '🍰', '/images/tres-leches.jpeg', 10],
        ['Pastel Fresa', 45.00, 'Repostería', '🍰', '/images/pastel-fresa.jpg', 10],
        ['Tartaleta Frutas', 42.00, 'Repostería', '🥧', '/images/tarta-frutas.jpg', 10],
        ['Cheesecake Zarzamora', 50.00, 'Repostería', '🍰', '/images/zarzamora.webp', 10],

        // Bebidas
        ['Café Americano', 32.00, 'Bebidas', '☕', '/images/americano.jpg', 10],
        ['Capuchino Vainilla', 45.00, 'Bebidas', '☕', '/images/capuccino.jpg', 10],
        ['Chocolate Caliente', 38.00, 'Bebidas', '🍫', '/images/chocolate-caliente.png', 10]
    ];

    for (const prod of initialProducts) {
        insertProduct.run(prod[0], prod[1], prod[2], prod[3], prod[4], prod[5]);
    }
}

module.exports = db;