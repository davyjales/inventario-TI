const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { equipmentNameFilter, equipmentUserFilter, adminUserFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT eh.id, eh.equipment_id, eh.action, eh.changed_fields, eh.user_id, eh.timestamp,
               e.nome AS equipment_name,
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

      // Build full snapshots cumulatively for all history records
      const snapshots = {};
      for (let i = historico.length - 1; i >= 0; i--) {
        const record = historico[i];
        try {
          const changedFields = JSON.parse(record.changed_fields || '{}');
          if (record.action === 'create') {
            snapshots[record.id] = changedFields;
          } else {
            const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] : {};
            snapshots[record.id] = { ...prevSnapshot, ...changedFields };
          }
        } catch (e) {
          console.error('Erro ao construir snapshots:', e);
          snapshots[record.id] = {};
        }
      }

      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const currentSnapshot = snapshots[record.id] || {};
          const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] : {};

          // Add full snapshot to record for frontend modal
          record.full_snapshot = currentSnapshot;

          // Add dono (user) from snapshot to record
          record.dono = currentSnapshot.dono || null;

          // Rename user_id to admin_id for clarity
          record.admin_id = record.user_id;
          delete record.user_id;

          // Compute diff with de and para
          const enrichedChanges = {};
          for (const key of Object.keys(currentSnapshot)) {
            if (JSON.stringify(currentSnapshot[key]) !== JSON.stringify(prevSnapshot[key])) {
              enrichedChanges[key] = {
                de: prevSnapshot[key] !== undefined ? prevSnapshot[key] : 'Não informado',
                para: currentSnapshot[key]
              };
            }
          }

          // Enrich special fields like status_id and cargo
          if (enrichedChanges['status_id']) {
            const change = enrichedChanges['status_id'];
            if ((typeof change.de === 'number' || typeof change.de === 'string') &&
                (typeof change.para === 'number' || typeof change.para === 'string')) {
              const [[statusDe]] = await db.query(
                'SELECT nome FROM status_equipamentos WHERE id = ?',
                [change.de]
              );
              const [[statusPara]] = await db.query(
                'SELECT nome FROM status_equipamentos WHERE id = ?',
                [change.para]
              );
              enrichedChanges['Status'] = {
                de: statusDe ? statusDe.nome : change.de,
                para: statusPara ? statusPara.nome : change.para
              };
            } else {
              enrichedChanges['Status'] = {
                de: change.de,
                para: change.para
              };
            }
            delete enrichedChanges['status_id'];
          }

          if (enrichedChanges['cargo']) {
            enrichedChanges['Cargo'] = {
              de: enrichedChanges['cargo'].de,
              para: enrichedChanges['cargo'].para
            };
            delete enrichedChanges['cargo'];
          }

          // Handle additional fields and others as before
          for (const [field, change] of Object.entries(enrichedChanges)) {
            if (field === 'Status' || field === 'Cargo') continue;

            if (field === 'categoria') {
              const [rows] = await db.query(
                `
                SELECT cca.nome_exibicao,
                      (SELECT valor FROM equipamento_campos_adicionais 
                        WHERE equipamento_id = ? AND campo_id = cca.id AND id = ?) AS valor_de,
                      (SELECT valor FROM equipamento_campos_adicionais 
                        WHERE equipamento_id = ? AND campo_id = cca.id AND id = ?) AS valor_para
                FROM categoria_campos_adicionais cca
                WHERE cca.id IN (?, ?)
                LIMIT 1
                `,
                [
                  record.equipment_id, change.de,
                  record.equipment_id, change.para,
                  change.de, change.para
                ]
              );

              if (rows.length > 0) {
                enrichedChanges[rows[0].nome_exibicao] = {
                  de: rows[0].valor_de,
                  para: rows[0].valor_para
                };
                delete enrichedChanges['categoria'];
              } else {
                enrichedChanges['Categoria'] = { de: change.de, para: change.para };
              }
            } else {
              const [extraField] = await db.query(
                `SELECT nome_exibicao 
                FROM categoria_campos_adicionais 
                WHERE id = ? LIMIT 1`,
                [field]
              );

              if (extraField.length > 0) {
                const [[valorDe]] = await db.query(
                  `SELECT valor FROM equipamento_campos_adicionais 
                  WHERE equipamento_id = ? AND campo_id = ? AND id = ?`,
                  [record.equipment_id, field, change.de]
                );

                const [[valorPara]] = await db.query(
                  `SELECT valor FROM equipamento_campos_adicionais 
                  WHERE equipamento_id = ? AND campo_id = ? AND id = ?`,
                  [record.equipment_id, field, change.para]
                );

                enrichedChanges[extraField[0].nome_exibicao] = {
                  de: valorDe ? valorDe.valor : change.de,
                  para: valorPara ? valorPara.valor : change.para
                };
                delete enrichedChanges[field];
              }
            }
          }

          record.changed_fields = JSON.stringify(enrichedChanges);
        } catch (e) {
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
