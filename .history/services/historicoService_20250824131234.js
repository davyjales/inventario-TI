const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { equipmentNameFilter, equipmentUserFilter, adminUserFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT eh.id, eh.equipment_id, eh.action, eh.changed_fields, eh.user_id, eh.timestamp,
               e.nome AS equipment_name,
               e.dono AS equipment_owner,
               e.hostname AS equipment_hostname,
               e.serial AS equipment_serial,
               e.patrimonio AS equipment_patrimonio,
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

      // Monta snapshots cumulativos (só para "de")
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

      // Campos que não queremos mostrar no diff
      const ignoreKeys = ['id', 'categoria_id', 'status_id', 'status_nome', 'user_id'];

      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const currentSnapshot = snapshots[record.id] || {};
          const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] : {};

          // Snapshot completo (pra modal do front)
          record.full_snapshot = currentSnapshot;

          // Dono do equipamento (vem do banco ou snapshot)
          record.dono = record.equipment_owner || currentSnapshot.dono || null;

          // Renomeia user_id → admin_id
          record.admin_id = record.user_id;
          delete record.user_id;

          // Valores atuais do banco (sempre up-to-date)
          const dbValues = {
            nome: record.equipment_name,
            dono: record.equipment_owner,
            hostname: record.equipment_hostname,
            serial: record.equipment_serial,
            patrimonio: record.equipment_patrimonio
          };

          // Monta diffs
          const enrichedChanges = {};
          for (const key of Object.keys(currentSnapshot)) {
            if (ignoreKeys.includes(key)) continue;

            const prevValue = prevSnapshot[key];
            // 👉 "para" vem do banco se existir, senão cai no snapshot
            const currValue = dbValues[key] !== undefined ? dbValues[key] : currentSnapshot[key];

            if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
              let nomeCampo = key; // valor padrão

              // Se for campo adicional (ex: "campo_12")
              if (key.startsWith("campo_")) {
                const campoId = key.split("_")[1];
                nomeCampo = `Campo adicional ${campoId}`;
                // O frontend troca pelo nome real via additionalFieldsMap
              }

              enrichedChanges[key] = {
                campo: nomeCampo,
                de: prevValue !== undefined ? prevValue : 'Não informado',
                para: currValue !== undefined ? currValue : 'Não informado'
              };
            }
          }

          // Traduções de nomes
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

      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
