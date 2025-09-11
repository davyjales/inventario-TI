const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Servir arquivos estáticos a partir da raiz do projeto
app.use(express.static(__dirname));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas da API
app.use('/api/equipamentos', require('./routes/equipamentos'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/status', require('./routes/status'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/historico', require('./routes/historico'));
app.use('/api/qrcode', require('./routes/qrcode'));
app.use('/api/qrcode-string', require('./routes/qrcode-string'));
app.use('/admin', require('./routes/admin'));

// Endpoint for campos-adicionais (used by Excel export)
app.get('/api/campos-adicionais', require('./services/categoriasService').listarCategorias);

// Rota de registro
app.post('/register', async (req, res) => {
  // Existing code...
});

// Rota admin para gerenciar usuários
app.get('/admin/users', async (req, res) => {
  // Existing code...
});

// Rota para abrir o index.html ao acessar /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Export the app instance
module.exports = app;

// Start the server only if this file is run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://10.137.174.213:${PORT}`);
  });
}
