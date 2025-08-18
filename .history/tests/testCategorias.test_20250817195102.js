const request = require('supertest');
const app = require('../server'); // Adjust the path to your server file

describe('GET /api/categorias/opcoes', () => {
  it('should return a list of options for the "lista" type', async () => {
    const res = await request(app).get('/api/categorias/opcoes');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array); // Ensure the response is an array
    // Add more assertions based on the expected structure of the options
  });
});
