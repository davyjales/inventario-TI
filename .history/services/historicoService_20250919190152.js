const db = require('../config/db');

module.exports = {
  async listarHistorico(req, res) {
    try {
      const { equipmentNameFilter, equipmentUserFilter, adminUserFilter, actionFilter, startDate, endDate } = req.query;

      let query = `
        SELECT eh.id, eh.equipment_id, eh.action, eh.changed_fields, eh.user_id, eh.timestamp,
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

      // ---------- pega os valores atuais de campos adicionais ----------
      const [camposAdicionais] = await db.query(`SELECT equipamento_id, campo_id, valor, nome_campo FROM equipamento_campos_adicionais`);
      console.log('Campos Adicionais:', camposAdicionais);

      // Agrupa por equipamento
      const camposPorEquipamento = {};
      for (const c of camposAdicionais) {
        if (!camposPorEquipamento[c.equipamento_id]) {
          camposPorEquipamento[c.equipamento_id] = {};
        }
        camposPorEquipamento[c.equipamento_id][`campo_${c.campo_id}`] = {
          valor: c.valor,
          nome: c.nome_campo
        };
      }

      // ---------- snapshots históricos ----------
      const snapshots = {};

      // Primeiro, vamos buscar o estado atual de cada equipamento para usar como base
      const equipmentIds = [...new Set(historico.map(h => h.equipment_id))];
      const [equipamentosAtuais] = await db.query(

      // ---------- monta diffs ---------- 
      // Add current additional fields to the record
      for (const record of historico) {
        record.current_additionalFields = camposPorEquipamento[record.equipment_id] || {};
      }
      const ignoreKeys = ['id', 'categoria_id', 'status_id', 'status_nome', 'user_id'];

      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const currentSnapshot = snapshots[record.id] || {};
          const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] : {};

          // Snapshot completo
          record.full_snapshot = currentSnapshot;

          // Dono do equipamento
          record.dono = currentSnapshot.dono || null;
          // Adiciona campo user para frontend usar na coluna User
          record.user = currentSnapshot.dono || null;

          // Nome do equipamento do snapshot para coluna Equipamento
          record.equipment_name = currentSnapshot.nome || 'N/A';

          // Renomeia user_id → admin_id
          record.admin_id = record.user_id;
          delete record.user_id;

          // Monta diffs
          const enrichedChanges = {};

          for (const key of Object.keys(currentSnapshot)) {
            if (ignoreKeys.includes(key)) continue;

            let prevValue;
            if (prevSnapshot && prevSnapshot[key] !== undefined) {
              if (prevSnapshot[key] && typeof prevSnapshot[key] === 'object' && prevSnapshot[key].para !== undefined) {
                prevValue = prevSnapshot[key].para;
              } else {
                prevValue = prevSnapshot[key];
              }
            } else {
              prevValue = undefined;
            }
            let currValue = currentSnapshot[key]; // valor padrão
            let nomeCampo = key;

            if (key.startsWith("campo_")) {
              // Preferir o valor salvo no snapshot (o 'para' do snapshot),
              // e usar o label salvo no snapshot quando disponível.
              const snapshotCampo = currentSnapshot[key];

              if (snapshotCampo && (snapshotCampo.para !== undefined)) {
                currValue = snapshotCampo.para;
                nomeCampo = snapshotCampo.campo || `Campo adicional ${key.split("_")[1]}`;
              } else {
                // fallback: usar valor atual do banco se o snapshot não trouxer informação
                const eqCampos = camposPorEquipamento[record.equipment_id] || {};
                const campo = eqCampos[key];
                if (campo) {
                  currValue = campo.valor || 'N/A';
                  nomeCampo = campo.nome;
                } else {
                  currValue = 'Não informado';
                  nomeCampo = `Campo adicional ${key.split("_")[1]}`;
                }
              }
            }

            // Se for nome/dono → pega do snapshot armazenado
            if (key === 'nome') currValue = currentSnapshot.nome || 'N/A';
            if (key === 'dono') currValue = currentSnapshot.dono || 'N/A';

            // Só mostra se houve mudança
            if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
              enrichedChanges[key] = {
                campo: nomeCampo,
                de: prevValue !== undefined ? prevValue : 'Não informado',
                para: currValue
              };
            }
          }

          record.changed_fields = JSON.stringify(enrichedChanges);
        } catch (e) {
          console.log('Current Snapshot:', currentSnapshot);
          console.log('Previous Snapshot:', prevSnapshot);
          console.log('Campo:', campo);
          console.log('Current Value:', currValue);
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