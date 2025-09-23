const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { equipmentNameFilter, equipmentUserFilter, adminUserFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT eh.id, eh.equipment_id, eh.action, eh.changed_fields, eh.snapshot, eh.user_id, eh.timestamp,
               e.nome AS equipment_name,
               e.dono AS equipment_owner,
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

      if (actionFilter && ['create', 'update', 'delete', 'consulta'].includes(actionFilter)) {
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

      // NOVO FLUXO: Usar snapshot salvo diretamente no banco
      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          // Parse do snapshot salvo no banco
          let snapshot = null;
          try {
            snapshot = JSON.parse(record.snapshot || '{}');
          } catch (e) {
            console.error('Erro ao parsear snapshot:', e);
            snapshot = {};
          }

          // Se não tem snapshot válido, usar changed_fields como fallback (compatibilidade)
          if (!snapshot || Object.keys(snapshot).length === 0) {
            try {
              snapshot = JSON.parse(record.changed_fields || '{}');
            } catch (e) {
              snapshot = {};
            }
          }

          // Snapshot completo
          record.full_snapshot = snapshot;

          // Dono do equipamento
          record.dono = snapshot.dono || null;
          // Adiciona campo user para frontend usar na coluna User
          record.user = snapshot.dono || null;

          // Nome do equipamento do snapshot para coluna Equipamento
          record.equipment_name = snapshot.nome || 'N/A';

          // Renomeia user_id → admin_id
          record.admin_id = record.user_id;
          delete record.user_id;

          // Monta diffs apenas para ações de update
          if (record.action === 'update') {
            const enrichedChanges = {};
            const changedFields = JSON.parse(record.changed_fields || '{}');

            // Processa mudanças formatadas (de/para)
            for (const [key, value] of Object.entries(changedFields)) {
              if (value && typeof value === 'object' && value.de !== undefined && value.para !== undefined) {
                let displayName = key;

                // Se for campo adicional (campo_14, etc), buscar nome_exibicao
                if (key.startsWith('campo_')) {
                  const campoId = key.split('_')[1];
                  const [campoInfo] = await db.query(
                    'SELECT nome_exibicao FROM categoria_campos_adicionais WHERE id = ?',
                    [campoId]
                  );
                  displayName = campoInfo.length > 0 ? campoInfo[0].nome_exibicao : `Campo ${campoId}`;
                }

                enrichedChanges[key] = {
                  campo: displayName,
                  de: value.de,
                  para: value.para
                };
              }
            }

            record.changed_fields = JSON.stringify(enrichedChanges);
          }
        } catch (e) {
          console.error('Erro ao processar registro do histórico:', e);
          record.full_snapshot = {
            nome: 'N/A',
            dono: 'N/A',
            setor: 'N/A',
            descricao: 'N/A',
            cargo: 'N/A',
            qrcode: 'N/A',
            categoria_id: null,
            status_id: null,
            additionalFields: {}
          };
          record.dono = 'N/A';
          record.user = 'N/A';
          record.equipment_name = 'N/A';
          record.admin_id = record.user_id;
          delete record.user_id;
        }
      }

      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};