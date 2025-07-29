// --- substitua seu server.js atual por este abaixo --- //

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SECRET = 'segredo_supersecreto';

app.use(cors());
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware para admin
function verificarAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ erro: 'Token ausente' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    if (!user.admin) return res.status(403).json({ erro: 'Acesso negado' });
    req.user = user;
    next();
  });
}

// Middleware para inventariante ou admin
function verificarAcessoGeral(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ erro: 'Token ausente' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    if (!user.admin && !user.inventariante) return res.status(403).json({ erro: 'Acesso negado' });
    req.user = user;
    next();
  });
}

// ---------------- EQUIPAMENTOS ---------------- //

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
const termoUpload = upload.single('termo');

app.post('/equipamentos', termoUpload, async (req, res) => {
  const { categoria, nome, dono, setor, descricao, hostname, status } = req.body;
  const termo = req.file ? req.file.filename : null;

  if (!categoria || !nome || !dono || !setor) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  const identificador = uuidv4();
  const nomeQRCode = `${categoria}_${identificador}.png`.replace(/\s/g, '_');
  const caminhoQRCode = path.join(__dirname, 'uploads', nomeQRCode);

  try {
    await QRCode.toFile(caminhoQRCode, identificador, { width: 300, margin: 2 });
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code.' });
  }

  const query = `
    INSERT INTO equipamentos 
    (categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(query, [categoria, nome, dono, setor, descricao, termo, identificador, hostname || null, status || 'disponivel'], (err, result) => {
    if (err) return res.status(400).json({ error: err.message });
    res.status(201).json({ message: 'Equipamento cadastrado com sucesso!', id: result.insertId });
  });
});

app.get('/equipamentos', (req, res) => {
  const { hostname, status } = req.query;
  let query = 'SELECT * FROM equipamentos WHERE 1=1';
  const values = [];

  if (hostname) {
    query += ' WHERE hostname LIKE ?';
    values.push(`%${hostname}%`);
  }

  if (status) {
    query += ' AND status = ?';
    values.push(status);
  }


  db.query(query, values, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar equipamentos.' });
    res.json(results);
  });
});

app.get('/equipamentos/:id', (req, res) => {
  const { id } = req.params;
  const query = `
    SELECT id, categoria, nome, dono, setor, descricao, termo, qrCode, hostname , status
    FROM equipamentos 
    WHERE id = ?
  `;
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar equipamento.' });
    if (results.length === 0) return res.status(404).json({ error: 'Equipamento não encontrado.' });
    res.json(results[0]);
  });
});

app.delete('/equipamentos/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM equipamentos WHERE id = ?';
  db.query(query, [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao excluir equipamento.' });
    res.json({ message: 'Equipamento excluído com sucesso.' });
  });
});

// ---------- ATUALIZAÇÃO DE EQUIPAMENTO + TERMO ---------- //

app.put('/equipamentos/:id', upload.single('termo'), (req, res) => {
  if (!req.body) return res.status(400).json({ error: 'Corpo da requisição está vazio.' });

  const { id } = req.params;
  const { categoria, nome, dono, setor, descricao, hostname, removerTermo, status } = req.body;
  const novoTermo = req.file ? req.file.filename : null;

  const buscarQuery = 'SELECT termo FROM equipamentos WHERE id = ?';
  db.query(buscarQuery, [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar equipamento.' });
    if (results.length === 0) return res.status(404).json({ error: 'Equipamento não encontrado.' });

    const termoAntigo = results[0].termo;
    const deveRemoverTermo = removerTermo === 'true';
    let novoValorTermo = termoAntigo;

    if (deveRemoverTermo || novoTermo) {
      if (termoAntigo) {
        const caminhoAntigo = path.join(__dirname, 'uploads', termoAntigo);
        fs.unlink(caminhoAntigo, (fsErr) => {
          if (fsErr && fsErr.code !== 'ENOENT') {
            console.warn('Erro ao remover termo antigo:', fsErr);
          }
        });
      }
      novoValorTermo = novoTermo || null;
    }

    const updateQuery = `
      UPDATE equipamentos
      SET categoria = ?, nome = ?, dono = ?, setor = ?, descricao = ?, hostname = ?, termo = ?, status = ?
      WHERE id = ?
    `;

    db.query(
      updateQuery,
      [categoria, nome, dono, setor, descricao, hostname || null, novoValorTermo, status || 'disponivel', id],
      (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao atualizar equipamento.' });
        res.json({ message: 'Equipamento atualizado com sucesso.' });
      }
    );
  });
});


// ---------------- CATEGORIAS ---------------- //

app.get('/categorias', (req, res) => {
  const query = 'SELECT nome FROM categorias';
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar categorias' });
    res.json(results.map(row => row.nome));
  });
});

app.post('/categorias', (req, res) => {
  const { categoria } = req.body;
  if (!categoria) return res.status(400).json({ error: 'Categoria é obrigatória' });

  const query = 'INSERT INTO categorias (nome) VALUES (?)';
  db.query(query, [categoria], (err, result) => {
    if (err) return res.status(500).json({ error: 'Erro ao inserir categoria' });
    res.status(201).json({ message: 'Categoria adicionada com sucesso', id: result.insertId });
  });
});

// ---------------- USUÁRIOS ---------------- //

app.post('/register', async (req, res) => {
  const { email, nome, user, senha } = req.body;

  if (!email || !nome || !user || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  const checkUser = 'SELECT * FROM usuarios WHERE user = ? OR email = ?';
  db.query(checkUser, [user, email], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (results.length > 0) return res.status(409).json({ error: 'Usuário ou email já existe.' });

    const hashedPassword = await bcrypt.hash(senha, 12);

    const insertQuery = `
      INSERT INTO usuarios (email, nome, user, senha)
      VALUES (?, ?, ?, ?)
    `;
    db.query(insertQuery, [email, nome, user, hashedPassword], (err) => {
      if (err) return res.status(500).json({ error: 'Erro ao registrar usuário.' });
      res.status(201).json({ message: 'Usuário registrado com sucesso!' });
    });
  });
});

app.post('/login', express.json(), (req, res) => {
  const { user, senha } = req.body;
  if (!user || !senha) return res.status(400).json({ error: 'User e senha são obrigatórios.' });

  const query = 'SELECT * FROM usuarios WHERE user = ?';
  db.query(query, [user], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (results.length === 0) return res.status(401).json({ error: 'Usuário não encontrado.' });

    const usuario = results[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) return res.status(401).json({ error: 'Senha incorreta.' });
    if (!usuario.autorizado) return res.status(403).json({ error: 'Usuário não autorizado.' });

    const token = jwt.sign({
      id: usuario.id,
      user: usuario.user,
      admin: usuario.admin,
      inventariante: usuario.inventariante
    }, SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido', token });
  });
});

// ---------------- ADMINISTRAÇÃO ---------------- //

app.get('/admin/users', verificarAdmin, (req, res) => {
  const sql = 'SELECT id, nome, user, email, admin, autorizado, inventariante FROM usuarios';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ erro: 'Erro no banco' });
    res.json(results);
  });
});

app.post('/admin/toggle-admin/:id', verificarAdmin, (req, res) => {
  const id = req.params.id;
  const sql = 'UPDATE usuarios SET admin = NOT admin WHERE id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar admin' });
    res.sendStatus(200);
  });
});

app.post('/admin/toggle-inventariante/:id', verificarAdmin, (req, res) => {
  const id = req.params.id;
  const sql = 'UPDATE usuarios SET inventariante = NOT inventariante WHERE id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar inventariante' });
    res.sendStatus(200);
  });
});

app.post('/admin/toggle-autorizado/:id', verificarAdmin, (req, res) => {
  const id = req.params.id;
  const sql = 'UPDATE usuarios SET autorizado = NOT autorizado WHERE id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao atualizar autorização' });
    res.sendStatus(200);
  });
});

app.post('/admin/alterar-senha/:id', verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { novaSenha } = req.body;

  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'Senha inválida. Mínimo 6 caracteres.' });
  }

  try {
    const hash = await bcrypt.hash(novaSenha, 12);
    const query = 'UPDATE usuarios SET senha = ? WHERE id = ?';
    db.query(query, [hash, id], (err) => {
      if (err) return res.status(500).json({ erro: 'Erro ao atualizar senha.' });
      res.json({ message: 'Senha atualizada com sucesso.' });
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao processar a senha.' });
  }
});

app.delete('/admin/excluir/:id', verificarAdmin, (req, res) => {
  const id = req.params.id;
  const sql = 'DELETE FROM usuarios WHERE id = ?';
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao deletar usuário' });
    res.sendStatus(200);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
