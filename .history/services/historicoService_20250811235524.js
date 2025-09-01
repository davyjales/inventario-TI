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

          // Fetch categoria_id for the equipment
          let categoriaId = null;
          if (record.equipment_id) {
            const [equipRows] = await db.query('SELECT categoria_id FROM equipamentos WHERE id = ?', [record.equipment_id]);
            if (equipRows.length > 0) {
              categoriaId = equipRows[0].categoria_id;
            }
          }

          // Fetch all additional fields for the equipment's category
          let additionalFields = [];
          if (categoriaId) {
            const [additionalRows] = await db.query(
              `SELECT nome_exibicao, nome_campo FROM categoria_campos_adicionais WHERE categoria_id = ?`,
              [categoriaId]
            );
            additionalFields = additionalRows;
          }

          // Build map of internal field name to display name
          const fieldNameToDisplayName = {};
          additionalFields.forEach(f => {
            fieldNameToDisplayName[f.nome_campo] = f.nome_exibicao;
          });

          for (const [field, change] of Object.entries(changedFields)) {
            if (field === 'categoria_id') {
              // Para categoria_id, mostrar nome do campo adicional e valores antigos e novos da tabela equipamento_campos_adicionais
              // Buscar nome do campo adicional na tabela categoria_campos_adicionais pelo nome do campo (field)
              let nomeExibicao = field;
              if (categoriaId) {
                const [categoriaCampoRows] = await db.query(
                  'SELECT nome_exibicao FROM categoria_campos_adicionais WHERE nome_exibicao = ? AND categoria_id = ?',
                  [field, categoriaId]
                );
                if (categoriaCampoRows.length > 0) {
                  nomeExibicao = categoriaCampoRows[0].nome_exibicao;
                }
              }

              // Buscar valores antigos e novos na tabela equipamento_campos_adicionais pelo equipamento_id e nome_campo
              const [oldValRows] = await db.query(
                'SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ? AND valor = ?',
                [record.equipment_id, field, change.de]
              );
              const [newValRows] = await db.query(
                'SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ? AND valor = ?',
                [record.equipment_id, field, change.para]
              );

              enrichedChanges[nomeExibicao] = {
                de: oldValRows.length > 0 ? oldValRows[0].valor : change.de,
                para: newValRows.length > 0 ? newValRows[0].valor : change.para
              };
            } else if (field === 'status_id') {
              // Buscar nome do status pelo id
              const [statusRows] = await db.query('SELECT nome FROM status_equipamentos WHERE id = ?', [change.de]);
              const [statusRowsPara] = await db.query('SELECT nome FROM status_equipamentos WHERE id = ?', [change.para]);
              enrichedChanges['Status'] = {
                de: statusRows.length > 0 ? statusRows[0].nome : change.de,
                para: statusRowsPara.length > 0 ? statusRowsPara[0].nome : change.para
              };
            } else if (field === 'cargo') {
              // Manter valor atual
              enrichedChanges['Cargo'] = change;
            } else {
              // Additional fields: get display name from map
              const displayName = fieldNameToDisplayName[field] || field;

              // Get old and new values from equipamento_campos_adicionais by equipamento_id and nome_campo
              const [oldValRows] = await db.query(
                `SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ? AND valor = ?`,
                [record.equipment_id, field, change.de]
              );
              const [newValRows] = await db.query(
                `SELECT valor FROM equipamento_campos_adicionais WHERE equipamento_id = ? AND nome_campo = ? AND valor = ?`,
                [record.equipment_id, field, change.para]
              );

              enrichedChanges[displayName] = {
                de: oldValRows.length > 0 ? oldValRows[0].valor : change.de,
                para: newValRows.length > 0 ? newValRows[0].valor : change.para
              };
            }
          }

          record.changed_fields = JSON.stringify(enrichedChanges);
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
