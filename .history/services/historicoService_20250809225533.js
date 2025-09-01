const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const [historico] = await db.query(`
        SELECT h.*, u.username 
        FROM equipment_history h
        JOIN usuarios u ON h.user_id = u.id
        ORDER BY h.data DESC
      `);
      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
