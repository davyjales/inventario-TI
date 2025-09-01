const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { textFilter, userFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT * 
        FROM equipment_history
      `;

      const conditions = [];
      const params = [];

      if (textFilter) {
        // Filter by qrCode, serviceTag, or equipment user (assuming columns qrCode, serviceTag, equipmentUser)
        conditions.push(`(qrCode LIKE ? OR serviceTag LIKE ? OR equipmentUser LIKE ?)`);
        const likeText = '%' + textFilter + '%';
        params.push(likeText, likeText, likeText);
      }

      if (userFilter) {
        conditions.push(`user LIKE ?`);
        params.push('%' + userFilter + '%');
      }

      if (actionFilter && (actionFilter === 'create' || actionFilter === 'update')) {
        conditions.push(`action = ?`);
        params.push(actionFilter);
      }

      if (startDate) {
        conditions.push(`timestamp >= ?`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`timestamp <= ?`);
        params.push(endDate);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY timestamp DESC';

      const [historico] = await db.query(query, params);
      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
