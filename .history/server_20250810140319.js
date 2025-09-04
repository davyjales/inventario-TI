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

// Rota admin para gerenciar usuários
app.get('/admin/users', async (req, res) => {
  try {
    const db = require('./db');
    const users = await new Promise((resolve, reject) => {
      db.all(
        'SELECT id, username, email, role, created_at FROM usuarios ORDER BY created_at DESC',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    res.json(users);
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

// Rota para abrir o index.html ao acessar /
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://10.218.172.40:${PORT}`);
});
