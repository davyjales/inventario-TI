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

      if (actionFilter && ['create', 'update', 'delete'].includes(actionFilter)) {
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

      // Monta snapshots cumulativos
      const snapshots = {};
      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const changedFields = JSON.parse(record.changed_fields || '{}');

          if (record.action === 'create') {
            snapshots[record.id] = changedFields;
          } else {
            const prevSnapshot = i > 0 ? snapshots[historico[i - 1].id] : {};
            snapshots[record.id] = { ...prevSnapshot, ...changedFields };
          }
        } catch (e) {
          console.error('Erro ao construir snapshots:', e);
          snapshots[record.id] = {};
        }
      }

      // Campos que não queremos mostrar no diff
      const ignoreKeys = ['id', 'categoria_id', 'status_id', 'status_nome', 'user_id'];

      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const currentSnapshot = snapshots[record.id] || {};
          const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] : {};

          // Snapshot completo (pra modal do front)
          record.full_snapshot = currentSnapshot;

          // Dono do equipamento (vem do snapshot)
          record.dono = currentSnapshot.dono || null;

          // Renomeia user_id → admin_id
          record.admin_id = record.user_id;
          delete record.user_id;

          // 🔹 Extrair campos adicionais atuais
          const currentAdditionalFields = {};
          for (const [key, value] of Object.entries(currentSnapshot)) {
            if (key.startsWith("campo_")) {
              const campoId = key.split("_")[1];
              currentAdditionalFields[campoId] = value;
            }
          }
          record.current_additionalFields = currentAdditionalFields;

          // Monta diffs
          const enrichedChanges = {};
          for (const key of Object.keys(currentSnapshot)) {
            if (ignoreKeys.includes(key)) continue;

            const prevValue = prevSnapshot[key];
            const currValue = currentSnapshot[key];

            if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
              let nomeCampo = key; // valor padrão

              // 👉 Se for campo adicional (ex: "campo_12")
              if (key.startsWith("campo_")) {
                const campoId = key.split("_")[1];
                nomeCampo = `Campo adicional ${campoId}`;
                // O frontend troca esse nome pelo de exibição via additionalFieldsMap
              }

              enrichedChanges[key] = {
                campo: nomeCampo,
                de: prevValue !== undefined ? prevValue : 'Não informado',
                para: currValue !== undefined ? currValue : 'Não informado'
              };
            }
          }

          // Traduções
          if (enrichedChanges['status']) {
            enrichedChanges['Status'] = enrichedChanges['status'];
            delete enrichedChanges['status'];
          }

          if (enrichedChanges['cargo']) {
            enrichedChanges['Cargo'] = enrichedChanges['cargo'];
            delete enrichedChanges['cargo'];
          }

          record.changed_fields = JSON.stringify(enrichedChanges);
        } catch (e) {
          console.error('Erro ao enriquecer changed_fields:', e);
        }
      }

      console.log('Changed Fields:', historico); // Log the entire history object
      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
