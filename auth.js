const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./db');

const router = express.Router();
const SECRET = 'sua_chave_secreta'; // ideal guardar como variável de ambiente

// Middleware de verificação de token
function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token ausente.' });

  jwt.verify(token, SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido.' });
    req.user = decoded;
    next();
  });
}

// Middleware para verificação de administrador
function verificarAdmin(req, res, next) {
  verificarToken(req, res, () => {
    if (!req.user.admin) {
      return res.status(403).json({ error: 'Acesso restrito a administradores.' });
    }
    next();
  });
}

// Rota de registro
router.post('/register', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }

  try {
    const hash = await bcrypt.hash(senha, 10);
    const sql = 'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)';
    db.query(sql, [nome, email, hash], (err) => {
      if (err) return res.status(400).json({ error: 'Email já cadastrado ou erro no registro.' });
      res.status(201).json({ message: 'Cadastro realizado. Aguarde autorização do administrador.' });
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno ao registrar.' });
  }
});

// Rota de login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
    if (err || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado.' });

    const usuario = results[0];

    if (!usuario.autorizado) {
      return res.status(403).json({ error: 'Usuário não autorizado pelo administrador.' });
    }

    const isValid = await bcrypt.compare(senha, usuario.senha);
    if (!isValid) return res.status(401).json({ error: 'Senha incorreta.' });

    const token = jwt.sign({ id: usuario.id, admin: !!usuario.admin }, SECRET, { expiresIn: '1d' });
    res.json({
      message: 'Login bem-sucedido',
      token,
      nome: usuario.nome,
      admin: !!usuario.admin
    });
  });
});

// Rotas administrativas
router.get('/admin/pendentes', verificarAdmin, (req, res) => {
  db.query('SELECT id, nome, email FROM usuarios WHERE autorizado = FALSE', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários pendentes.' });
    res.json(rows);
  });
});

router.post('/admin/autorizar', verificarAdmin, (req, res) => {
  const { id } = req.body;
  db.query('UPDATE usuarios SET autorizado = TRUE WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao autorizar usuário.' });
    res.json({ message: 'Usuário autorizado com sucesso.' });
  });
});

router.post('/admin/desautorizar', verificarAdmin, (req, res) => {
  const { id } = req.body;
  db.query('UPDATE usuarios SET autorizado = FALSE WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao desautorizar usuário.' });
    res.json({ message: 'Usuário desautorizado com sucesso.' });
  });
});

router.post('/admin/excluir', verificarAdmin, (req, res) => {
  const { id } = req.body;
  db.query('DELETE FROM usuarios WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao excluir usuário.' });
    res.json({ message: 'Usuário excluído com sucesso.' });
  });
});

router.post('/admin/promover', verificarAdmin, (req, res) => {
  const { id } = req.body;
  db.query('UPDATE usuarios SET admin = TRUE WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao promover usuário.' });
    res.json({ message: 'Usuário promovido a administrador.' });
  });
});

router.post('/admin/rebaixar', verificarAdmin, (req, res) => {
  const { id } = req.body;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Você não pode remover seu próprio acesso de administrador.' });
  }
  db.query('UPDATE usuarios SET admin = FALSE WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao rebaixar usuário.' });
    res.json({ message: 'Usuário rebaixado com sucesso.' });
  });
});

router.get('/admin/usuarios', verificarAdmin, (req, res) => {
  db.query('SELECT id, nome, email, admin FROM usuarios WHERE autorizado = TRUE', (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar usuários.' });
    res.json(rows);
  });
});

router.post('/admin/toggleAdmin', verificarAdmin, (req, res) => {
  const { id, admin } = req.body;
  db.query('UPDATE usuarios SET admin = ? WHERE id = ?', [admin, id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao alterar privilégio.' });
    res.json({ message: 'Privilégio atualizado.' });
  });
});

module.exports = router;
