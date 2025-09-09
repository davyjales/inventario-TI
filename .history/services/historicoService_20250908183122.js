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

      // ---------- pega os valores atuais de campos adicionais ----------
      const [camposAdicionais] = await db.query(`SELECT equipamento_id, campo_id, valor, nome_campo FROM equipamento_campos_adicionais`);
      console.log('Campos Adicionais:', camposAdicionais);

      // Agrupa por equipamento
      const camposPorEquipamento = {};
      for (const c of camposAdicionais) {
        if (!camposPorEquipamento[c.equipamento_id]) {
          camposPorEquipamento[c.equipamento_id] = {};
        }
        // chave igual à que o front espera: 'campo_<id>'
        camposPorEquipamento[c.equipamento_id][`campo_${c.campo_id}`] = {
          valor: c.valor,
          nome: c.nome_campo
        };
      }

      // ---------- snapshots históricos (normaliza diffs para snapshots planos) ----------
      // vamos construir snapshots[record.id] = { chave: valor_atual_apos_essa_alteracao, campo_14: 'x', additionalFields: {14: 'x'} ... }
      const snapshots = {};
      for (let i = historico.length - 1; i >= 0; i--) {
        const record = historico[i];
        try {
          const rawChanged = JSON.parse(record.changed_fields || '{}');

          // Normaliza changed_fields para um objeto "flat" de valores
          const normalized = {};
          const normalizedAdditionalFields = {};

          for (const [k, v] of Object.entries(rawChanged)) {
            // Caso especial: additionalFields vem como { campo: 'additionalFields', de: {...}, para: {...} }
            if (k === 'additionalFields' && v && typeof v === 'object') {
              const de = v.de || {};
              const para = v.para || {};
              const allIds = new Set([...Object.keys(de), ...Object.keys(para)]);
              for (const id of allIds) {
                const val = (para[id] !== undefined) ? para[id] : de[id];
                normalized[`campo_${id}`] = val;
                normalizedAdditionalFields[id] = val;
              }
              // também adiciona a chave additionalFields pra compatibilidade (obj id->valor)
              if (Object.keys(normalizedAdditionalFields).length > 0) {
                normalized['additionalFields'] = normalizedAdditionalFields;
              }
            } else if (v && typeof v === 'object' && ('para' in v)) {
              // campos simples que vieram como { campo: 'dono', de: 'antigo', para: 'novo' }
              normalized[k] = v.para;
            } else {
              // valor simples
              normalized[k] = v;
            }
          }

          // Mescla com snapshot mais novo (o array está sendo percorrido do mais antigo ao mais novo,
          // e snapshots[historico[i + 1].id] contém o estado posterior já normalizado)
          const nextSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] || {} : {};
          snapshots[record.id] = { ...nextSnapshot, ...normalized };
        } catch (e) {
          console.error('Erro ao construir snapshots para record.id=' + record.id, e);
          snapshots[record.id] = {};
        }
      }

      // ---------- monta diffs ----------
      // Add current additional fields to the record (valores atuais do banco)
      for (const record of historico) {
        record.current_additionalFields = camposPorEquipamento[record.equipment_id] || {};
      }

      // agora ignoreKeys inclui 'additionalFields' para não duplicar
      const ignoreKeys = ['id', 'categoria_id', 'status_id', 'status_nome', 'user_id', 'additionalFields'];

      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const currentSnapshot = snapshots[record.id] || {};
          const prevSnapshot = i < historico.length - 1 ? snapshots[historico[i + 1].id] || {} : {};

          // Snapshot completo (para frontend)
          record.full_snapshot = currentSnapshot;

          // Dono do equipamento
          record.dono = record.equipment_owner || currentSnapshot.dono || null;

          // Renomeia user_id → admin_id
          record.admin_id = record.user_id;
          delete record.user_id;

          // Monta diffs
          const enrichedChanges = {};

          for (const key of Object.keys(currentSnapshot)) {
            if (ignoreKeys.includes(key)) continue;

            const prevValue = prevSnapshot[key];
            let currValue = currentSnapshot[key]; // valor padrão
            let nomeCampo = key;

            // Se for campo adicional já normalizado (campo_14) → força pegar valor atual do banco
            if (key.startsWith("campo_")) {
              const eqCampos = camposPorEquipamento[record.equipment_id] || {};
              const campo = eqCampos[key];
              if (campo) {
                currValue = campo.valor || 'N/A'; // usa SEMPRE o valor atual do banco
                nomeCampo = campo.nome;
              } else {
                currValue = 'Não informado';
                nomeCampo = `Campo adicional ${key.split("_")[1]}`;
              }
            }

            // Se for nome/dono → pega do banco (join)
            if (key === 'nome') currValue = record.equipment_name;
            if (key === 'dono') currValue = record.equipment_owner;

            // Só mostra se houve mudança (compara valores planos)
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
          console.error('Erro ao enriquecer changed_fields para record.id=' + record.id, e);
          // fallback
          record.changed_fields = record.changed_fields || '{}';
        }
      }

      res.json(historico);
    } catch (err) {
      console.error('Erro ao listar histórico:', err);
      res.status(500).json({ error: 'Erro ao listar histórico' });
    }
  }
};
