const db = require('../config/db');

module.exports = {
  async listarStatus(req, res) {
    try {
      const [status] = await db.query('SELECT * FROM status_equipamentos');
      res.json(status);
    } catch (err) {
      console.error('Erro ao listar status:', err);
      res.status(500).json({ error: 'Erro ao listar status' });
    }
  },

  async criarStatus(req, res) {
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    try {
      const [result] = await db.query('INSERT INTO status_equipamentos (nome) VALUES (?)', [nome]);
      res.status(201).json({ message: 'Status criado com sucesso', id: result.insertId });
    } catch (err) {
      console.error('Erro ao criar status:', err);
      res.status(500).json({ error: 'Erro ao criar status' });
    }
  },

  async atualizarStatus(req, res) {
    const { id } = req.params;
    const { nome } = req.body;
    if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

    try {
      await db.query('UPDATE status_equipamentos SET nome = ? WHERE id = ?', [nome, id]);
      res.json({ message: 'Status atualizado com sucesso' });
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  },

  async excluirStatus(req, res) {
    const { id } = req.params;
    try {
      await db.query('DELETE FROM status_equipamentos WHERE id = ?', [id]);
      res.json({ message: 'Status excluído com sucesso' });
    } catch (err) {
      console.error('Erro ao excluir status:', err);
      res.status(500).json({ error: 'Erro ao excluir status' });
    }
  }
};
