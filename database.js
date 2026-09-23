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
        ['Concha Vainilla', 15.00, 'Pan Dulce', '🍞', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 10],
        ['Concha Choco', 15.00, 'Pan Dulce', '🍞', 'https://images.unsplash.com/photo-1517433670267-08bbd4be890f?auto=format&fit=crop&w=400&q=80', 10],
        ['Croissant Mantequilla', 22.00, 'Pan Dulce', '🥐', 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=400&q=80', 10],
        ['Dona Chocolate', 18.00, 'Pan Dulce', '🍩', 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=400&q=80', 10],
        ['Dona Glaseada', 16.00, 'Pan Dulce', '🍩', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=400&q=80', 10],
        ['Oreja de Hojaldre', 20.00, 'Pan Dulce', '🥐', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 10],
        ['Chocolatín', 26.00, 'Pan Dulce', '🍫', 'https://images.unsplash.com/photo-1608198093002-ad4e005484ec?auto=format&fit=crop&w=400&q=80', 10],
        ['Garibaldi', 22.00, 'Pan Dulce', '🧁', 'https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=400&q=80', 10],
        ['Mantecada Nuez', 18.00, 'Pan Dulce', '🧁', 'https://images.unsplash.com/photo-1607958996333-41aef7caefaa?auto=format&fit=crop&w=400&q=80', 10],
        ['Besito Mermelada', 17.00, 'Pan Dulce', '🍪', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&q=80', 10],
        ['Cisne de Crema', 24.00, 'Pan Dulce', '🥐', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 10],
        ['Polvorón Naranja', 14.00, 'Pan Dulce', '🍪', 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=400&q=80', 10],

        // Pan Blanco
        ['Bolillo Rústico', 7.00, 'Pan Blanco', '🥖', 'https://images.unsplash.com/photo-1586444248902-2f64eddc1320?auto=format&fit=crop&w=400&q=80', 10],
        ['Telera', 8.00, 'Pan Blanco', '🥖', 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=400&q=80', 10],
        ['Baguette Artesanal', 28.00, 'Pan Blanco', '🥖', 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=400&q=80', 10],
        ['Pan Masamadre', 65.00, 'Pan Blanco', '🍞', 'https://images.unsplash.com/photo-1585478259715-876acc5be8eb?auto=format&fit=crop&w=400&q=80', 10],
        ['Pan Brioche', 25.00, 'Pan Blanco', '🍞', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=400&q=80', 10],

        // Repostería
        ['Pastel Tres Leches', 48.00, 'Repostería', '🍰', 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=400&q=80', 10],
        ['Pastel Fresa', 45.00, 'Repostería', '🍰', 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=400&q=80', 10],
        ['Tartaleta Frutas', 42.00, 'Repostería', '🥧', 'https://images.unsplash.com/photo-1519869325930-281384150729?auto=format&fit=crop&w=400&q=80', 10],
        ['Cheesecake Zarzamora', 50.00, 'Repostería', '🍰', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=400&q=80', 10],

        // Bebidas
        ['Café Americano', 32.00, 'Bebidas', '☕', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=400&q=80', 10],
        ['Capuchino Vainilla', 45.00, 'Bebidas', '☕', 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=400&q=80', 10],
        ['Chocolate Caliente', 38.00, 'Bebidas', '🍫', 'https://images.unsplash.com/photo-1542990253-0d0f5be5f0ed?auto=format&fit=crop&w=400&q=80', 10]
    ];

    for (const prod of initialProducts) {
        insertProduct.run(prod[0], prod[1], prod[2], prod[3], prod[4], prod[5]);
    }
}

module.exports = db;