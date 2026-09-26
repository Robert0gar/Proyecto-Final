const request = require('supertest');
const app = require('../server');

describe('Suite Completa Backend - Migajas Pati', () => {
  let adminToken = '';
  let userToken = '';

  beforeAll(async () => {
    // 1. Obtener token de Administrador (Gerente)
    const adminRes = await request(app)
      .post('/api/login')
      .send({ username: 'gerente', password: 'admin123' });
    adminToken = adminRes.body.token;

    // 2. Obtener token de Cajero
    const userRes = await request(app)
      .post('/api/login')
      .send({ username: 'cajero1', password: 'pan123' });
    userToken = userRes.body.token;
  });

  // ==========================================
  // 1. VISTAS Y CATÁLOGO DE PRODUCTOS
  // ==========================================
  describe('Vistas y Catálogo de Productos', () => {
    test('GET / debe servir la vista principal', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
    });

    test('GET /api/products debe retornar el catálogo de productos', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('GET /api/products/:id debe retornar un producto existente', async () => {
      const res = await request(app).get('/api/products/1');
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('id', 1);
    });

    test('GET /api/products/:id debe retornar 404 si el producto no existe', async () => {
      const res = await request(app).get('/api/products/999999');
      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe('Producto no encontrado.');
    });
  });

  // ==========================================
  // 2. REABASTECIMIENTO DE INVENTARIO
  // ==========================================
  describe('Reabastecimiento de Inventario', () => {
    test('POST /api/products/refill debe validar si falta cantidad o es <= 0', async () => {
      const res = await request(app)
        .post('/api/products/refill')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: 1, stock: 0 });
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/products/refill debe surtir stock a un producto correctamente', async () => {
      const res = await request(app)
        .post('/api/products/refill')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: 1, stock: 5 });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('Se agregaron 5 unidades');
    });

    test('POST /api/products/refill debe retornar 404 si el producto no existe', async () => {
      const res = await request(app)
        .post('/api/products/refill')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: 999999, stock: 5 });
      expect(res.statusCode).toBe(404);
    });
  });

  // ==========================================
  // 3. CARRITO DE COMPRAS Y VENTAS
  // ==========================================
  describe('Flujo de Carrito y Ventas', () => {
    test('POST /api/sales debe rechazar la venta si el carrito está vacío', async () => {
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ items: [], total: 0 });
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/sales debe procesar la venta correctamente', async () => {
      // Primero consultamos los productos reales para tomar uno con stock
      const prodRes = await request(app).get('/api/products');
      const validProduct = prodRes.body[0] || { id: 1, name: 'Concha Vainilla', price: 15.0 };

      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [
            { id: validProduct.id, productId: validProduct.id, name: validProduct.name, price: validProduct.price, quantity: 1 }
          ],
          total: validProduct.price,
          cashier: 'cajero1'
        });

      expect([200, 201]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('saleId');
    });

    test('GET /api/sales debe listar el historial de ventas del turno', async () => {
      const res = await request(app)
        .get('/api/sales')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('sales');
      expect(Array.isArray(res.body.sales)).toBe(true);
    });

    test('POST /api/sales/close-day debe realizar el corte de caja (Solo Admin)', async () => {
      const res = await request(app)
        .post('/api/sales/close-day')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe('Día finalizado exitosamente');
      expect(res.body).toHaveProperty('summary');
    });
  });

  // ==========================================
  // 4. MERMAS Y INTELIGENCIA DE NEGOCIO (DSS)
  // ==========================================
  describe('Mermas y Reportes Decision Support System', () => {
    test('POST /api/waste debe validar cantidad enviada', async () => {
      const res = await request(app)
        .post('/api/waste')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: 1, quantity: 0 });
      expect(res.statusCode).toBe(400);
    });

    test('POST /api/waste debe registrar una merma de pan', async () => {
      const res = await request(app)
        .post('/api/waste')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: 1,
          quantity: 2,
          reason: 'Pan frío/dañado'
        });
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('Se registraron 2 unidades mermadas');
    });

    test('POST /api/waste debe retornar 404 para un producto inexistente', async () => {
      const res = await request(app)
        .post('/api/waste')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ productId: 999999, quantity: 2 });
      expect(res.statusCode).toBe(404);
    });

    test('GET /api/reports/profitability-matrix debe generar la Matriz de Rentabilidad', async () => {
      const res = await request(app)
        .get('/api/reports/profitability-matrix')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.matrix)).toBe(true);
    });

    test('GET /api/reports/production-recommendation debe arrojar recomendaciones de horneado', async () => {
      const res = await request(app)
        .get('/api/reports/production-recommendation')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.recommendations)).toBe(true);
    });
  });
});