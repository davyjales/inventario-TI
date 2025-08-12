const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { equipmentNameFilter, equipmentUserFilter, adminUserFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT eh.id, eh.equipment_id, eh.action, eh.changed_fields, eh.user_id, eh.timestamp,
        e.nome AS equipment_name, e.dono AS equipment_user,
               u.nome AS admin_name
        FROM equipment_history eh
        LEFT JOIN equipamentos e ON eh.equipment_id = e.id
        LEFT JOIN usuarios u ON eh.user_id = u.id
      `;

      const conditions = [];
      const params = [];

      if (equipmentNameFilter) {
        conditions.push(`e.nome LIKE ?`);
        params.push('%' + equipmentNameFilter + '%');
      }

      if (equipmentUserFilter) {
        conditions.push(`e.dono LIKE ?`);
        params.push('%' + equipmentUserFilter + '%');
      }

      if (adminUserFilter) {
        conditions.push(`u.nome LIKE ?`);
        params.push('%' + adminUserFilter + '%');
      }

      if (actionFilter && (actionFilter === 'create' || actionFilter === 'update' || actionFilter === 'delete')) {
        conditions.push(`eh.action = ?`);
        params.push(actionFilter);
      }

      if (startDate) {
        conditions.push(`eh.timestamp >= ?`);
        params.push(startDate);
      }

      if (endDate) {
        conditions.push(`eh.timestamp <= ?`);
        params.push(endDate);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY eh.timestamp DESC';

      const [historico] = await db.query(query, params);

      // Enrich history with additional fields display names and values
      for (const record of historico) {
        try {
          const changedFields = JSON.parse(record.changed_fields || '{}');
          const enrichedChanges = {};

          for (const [field, change] of Object.entries(changedFields)) {
            if (field === 'categoria_id' || field === 'status_id' || field === 'cargo') {
              // Keep as is, frontend maps these
              enrichedChanges[field] = change;
            } else {
              // Additional fields: get display name and values
              // Get display name from categoria_campos_adicionais
              const [campoRows] = await db.query(
                `SELECT nome_exibicao FROM categoria_campos_adicionais WHERE nome_exibicao = ? LIMIT 1`,
                [field]
              );

              const displayName = campoRows.length > 0 ? campoRows[0].nome_exibicao : field;

              // Get old and new values from equipamento_campos_adicionais
              const [oldValRows] = await db.query(
                `SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ?`,
                [record.equipment_id, change.de]
              );
              const [newValRows] = await db.query(
                `SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ?`,
                [record.equipment_id, change.para]
              );

              enrichedChanges[displayName] = {
                de: oldValRows.length > 0 ? oldValRows[0].valor : change.de,
                para: newValRows.length > 0 ? newValRows[0].valor : change.para
              };
            }
          }

          record.changed_fields = enrichedChanges;
        } catch (e) {
          // If parsing or enrichment fails, keep original changed_fields
          console.error('Erro ao enriquecer changed_fields:', e);
        }
      }

      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
