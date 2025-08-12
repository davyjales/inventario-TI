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
app.use('/admin', require('./routes/admin'));

// Rota de registro
app.post('/register', async (req, res) => {
  const { nome, email, user, senha } = req.body;
  
  if (!nome || !email || !user || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    const bcrypt = require('bcrypt');
    const db = require('./db');
    
    // Verificar se usuário já existe
    const [existingUser] = await db.execute(
      'SELECT id FROM usuarios WHERE user = ? OR email = ?',
      [user, email]
    );
    
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Usuário ou email já cadastrado' });
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(senha, 10);
    
    // Inserir novo usuário
    const [result] = await db.execute(
      'INSERT INTO usuarios (user, email, senha, nome, criado_em) VALUES (?, ?, ?, ?, ?)',
      [user, email, hashedPassword, nome, new Date()]
    );
    
    res.status(201).json({ 
      message: 'Usuário cadastrado com sucesso',
      userId: result.insertId 
    });
    
  } catch (error) {
    console.error('Erro ao cadastrar usuário:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

// Rota admin para gerenciar usuários
app.get('/admin/users', async (req, res) => {
  try {
    const db = require('./db');
    const [rows] = await db.execute(
      'SELECT id, user, email, admin, autorizado, criado_em FROM usuarios ORDER BY criado_em DESC'
    );
    res.json(rows);
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
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
