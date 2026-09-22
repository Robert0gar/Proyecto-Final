const request = require('supertest');
const app = require('./server');

describe('Pruebas del Módulo de Autenticación (MigajasPaTi)', () => {
    
    it('Debe registrar un nuevo usuario/cajero correctamente', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({
                username: 'cajero_pedro',
                password: 'password123',
                role: 'usuario'
            });
        
        expect(res.statusCode).toEqual(201);
        expect(res.body).toHaveProperty('userId');
    });

    it('Debe rechazar el registro si faltan campos', async () => {
        const res = await request(app)
            .post('/api/register')
            .send({ username: 'incompleto' });

        expect(res.statusCode).toEqual(400);
    });

    it('Debe hacer Login exitosamente y devolver un Token JWT', async () => {
        // Primero registramos al usuario
        await request(app)
            .post('/api/register')
            .send({ username: 'gerente_maria', password: 'adminpassword', role: 'administrador' });

        // Intentamos loguearnos
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'gerente_maria', password: 'adminpassword' });

        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('token');
        expect(res.body.role).toBe('administrador');
    });

    it('Debe rechazar el Login con contraseña incorrecta', async () => {
        const res = await request(app)
            .post('/api/login')
            .send({ username: 'gerente_maria', password: 'password_incorrecta' });

        expect(res.statusCode).toEqual(401);
    });
});