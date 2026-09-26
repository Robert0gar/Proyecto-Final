const request = require('supertest');
const app = require('./server');

describe('Pruebas del Módulo de Autenticación (MigajasPaTi)', () => {

    // 1. Prueba de Login exitoso con el Gerente
    it('Debe hacer Login exitosamente con la cuenta de gerente', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'gerente',
                password: 'admin123'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.role).toBe('administrador');
    });

    // 2. Prueba de Login exitoso con un Cajero
    it('Debe hacer Login exitosamente con la cuenta de cajero1', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'cajero1',
                password: 'pan123'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
    });

    // 3. Prueba de rechazo por contraseña incorrecta
    it('Debe rechazar el Login con una contraseña errónea', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'gerente',
                password: 'password_incorrecta'
            });

        expect(res.statusCode).toEqual(401);
    });

    // 4. Prueba de rechazo si faltan credenciales o usuario no existe
    it('Debe rechazar el Login con un usuario inexistente', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({
                username: 'usuario_fantasma',
                password: '123'
            });

        expect(res.statusCode).toEqual(401);
    });

});