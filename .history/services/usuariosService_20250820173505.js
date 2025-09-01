const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { SECRET } = require('../middlewares/auth');

module.exports = {
  async registrarUsuario(req, res) {
    const { nome, email, user, senha } = req.body;
    if (!nome || !email || !user || !senha) {
      return res.status(400).json({ error: 'Nome, email, usuário e senha são obrigatórios' });
    }

    try {
      const hashedPassword = await bcrypt.hash(senha, 10);
      const [result] = await db.query(
        'INSERT INTO usuarios (nome, email, user, senha, admin, inventariante, autorizado) VALUES (?, ?, ?, ?, 0, 0, 0)',
        [nome, email, user, hashedPassword]
      );
      res.status(201).json({ 
        message: 'Usuário registrado com sucesso! Aguarde a autorização de um administrador.', 
        id: result.insertId 
      });
    } catch (err) {
      console.error('Erro ao registrar usuário:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ error: 'Usuário ou email já cadastrado' });
      } else {
        res.status(500).json({ error: 'Erro ao registrar usuário' });
      }
    }
  },

  async loginUsuario(req, res) {
    const { user, senha } = req.body;
    if (!user || !senha) return res.status(400).json({ error: 'Usuário e senha obrigatórios' });

    try {
      const [users] = await db.query('SELECT * FROM usuarios WHERE user = ?', [user]);
      if (users.length === 0) return res.status(401).json({ error: 'Credenciais inválidas' });

      const usuario = users[0];
      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
      if (!senhaCorreta) return res.status(401).json({ error: 'Credenciais inválidas' });

      if (!usuario.autorizado) return res.status(403).json({ error: 'Usuário não autorizado' });

      const token = jwt.sign(
        { id: usuario.id, user: usuario.user, admin: usuario.admin, inventariante: usuario.inventariante, autorizado: usuario.autorizado },
        SECRET,
        { expiresIn: '8h' }
      );

      res.json({ token, user: usuario });
    } catch (err) {
      console.error('Erro no login:', err);
      res.status(500).json({ error: 'Erro no login' });
    }
  },

  async listarUsuarios(req, res) {
    try {
      const [users] = await db.query('SELECT id, user, admin, inventariante, autorizado FROM usuarios');
      res.json(users);
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      res.status(500).json({ error: 'Erro ao listar usuários' });
    }
  },

  async toggleAdmin(req, res) {
    const { id } = req.params;
    try {
      await db.query('UPDATE usuarios SET admin = NOT admin WHERE id = ?', [id]);
      res.json({ message: 'Permissão de administrador alternada' });
    } catch (err) {
      console.error('Erro ao alternar admin:', err);
      res.status(500).json({ error: 'Erro ao alternar admin' });
    }
  },

  async toggleInventariante(req, res) {
    const { id } = req.params;
    try {
      await db.query('UPDATE usuarios SET inventariante = NOT inventariante WHERE id = ?', [id]);
      res.json({ message: 'Permissão de inventariante alternada' });
    } catch (err) {
      console.error('Erro ao alternar inventariante:', err);
      res.status(500).json({ error: 'Erro ao alternar inventariante' });
    }
  },

  async toggleAutorizado(req, res) {
    const { id } = req.params;
    try {
      await db.query('UPDATE usuarios SET autorizado = NOT autorizado WHERE id = ?', [id]);
      res.json({ message: 'Permissão de autorizado alternada' });
    } catch (err) {
      console.error('Erro ao alternar autorizado:', err);
      res.status(500).json({ error: 'Erro ao alternar autorizado' });
    }
  },

  async alterarSenha(req, res) {
    const { id } = req.params;
    const { novaSenha } = req.body;
    if (!novaSenha) return res.status(400).json({ error: 'Nova senha é obrigatória' });

    try {
      const hashedPassword = await bcrypt.hash(novaSenha, 10);
      await db.query('UPDATE usuarios SET senha = ? WHERE id = ?', [hashedPassword, id]);
      res.json({ message: 'Senha alterada com sucesso' });
    } catch (err) {
      console.error('Erro ao alterar senha:', err);
      res.status(500).json({ error: 'Erro ao alterar senha' });
    }
  },

  async excluirUsuario(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM usuarios WHERE id = ?', [id]);
      res.json({ message: 'Usuário excluído com sucesso' });
    } catch (err) {
      console.error('Erro ao excluir usuário:', err);
      res.status(500).json({ error: 'Erro ao excluir usuário' });
    }
  }
};
