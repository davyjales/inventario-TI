const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const [historico] = await db.query(`
        SELECT * 
        FROM equipment_history 
        ORDER BY timestamp DESC
      `);
      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
