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
      const [camposAdicionais] = await db.query(`
        SELECT eca.equipamento_id, eca.campo_id, eca.valor, eca.nome_campo, cca.nome_exibicao
        FROM equipamento_campos_adicionais eca
        LEFT JOIN categoria_campos_adicionais cca ON eca.campo_id = cca.id
      `);
      console.log('Campos Adicionais:', camposAdicionais);

      // Agrupa por equipamento
      const camposPorEquipamento = {};
      for (const c of camposAdicionais) {
        if (!camposPorEquipamento[c.equipamento_id]) {
          camposPorEquipamento[c.equipamento_id] = {};
        }
        camposPorEquipamento[c.equipamento_id][`campo_${c.campo_id}`] = {
          valor: c.valor,
          nome: c.nome_exibicao || c.nome_campo
        };
      }

      // ---------- snapshots históricos ----------
      const snapshots = {};

      // Para cada registro de histórico, buscar o estado do equipamento NO MOMENTO daquela alteração
      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const changedFields = JSON.parse(record.changed_fields || '{}');

          if (record.action === 'consulta') {
            // Para consulta, usar o snapshot armazenado no changed_fields
            snapshots[record.id] = changedFields;
          } else if (record.action === 'create') {
            // Para create, o changed_fields contém o estado completo
            snapshots[record.id] = changedFields;
          } else {
            // Para update, buscar o estado do equipamento ANTES da alteração
            // Para isso, vamos buscar o registro anterior deste equipamento
            const [equipamentoAntes] = await db.query(
              `SELECT e.nome, e.dono, e.setor, e.descricao, e.cargo, e.qrcode, e.status_id, e.categoria_id,
                      eca.equipamento_id, eca.campo_id, eca.valor, eca.nome_campo, cca.nome_exibicao
               FROM equipamentos e
               LEFT JOIN equipamento_campos_adicionais eca ON e.id = eca.equipamento_id
               LEFT JOIN categoria_campos_adicionais cca ON eca.campo_id = cca.id
               WHERE e.id = ?`,
              [record.equipment_id]
            );

            // Construir snapshot baseado no estado atual (que representa o estado ANTES da alteração atual)
            const snapshot = {
              nome: equipamentoAntes[0]?.nome || 'N/A',
              dono: equipamentoAntes[0]?.dono || 'N/A',
              setor: equipamentoAntes[0]?.setor || 'N/A',
              descricao: equipamentoAntes[0]?.descricao || 'N/A',
              cargo: equipamentoAntes[0]?.cargo || 'N/A',
              qrcode: equipamentoAntes[0]?.qrcode || 'N/A',
              categoria_id: equipamentoAntes[0]?.categoria_id,
              status_id: equipamentoAntes[0]?.status_id,
              additionalFields: {}
            };

            // Adicionar campos adicionais
            snapshot.additionalFields = equipamentoAntes
        .filter(eq => eq.campo_id)
        .map(eq => ({
          nome: eq.nome_exibicao || `Campo ${eq.campo_id}`,
          valor: eq.valor || 'N/A'
        }));

            // Para campos que foram alterados, usar o valor 'de' (valor anterior)
            for (const [key, value] of Object.entries(changedFields)) {
              if (value && typeof value === 'object' && value.de !== undefined) {
                snapshot[key] = value.de;
              }
            }

            snapshots[record.id] = snapshot;
          }
        } catch (e) {
          console.error('Erro ao construir snapshots:', e);
          // Fallback: buscar estado atual
          const [equipamentoAtual] = await db.query(
            `SELECT e.nome, e.dono, e.setor, e.descricao, e.cargo, e.qrcode, e.status_id, e.categoria_id,
                    eca.equipamento_id, eca.campo_id, eca.valor, eca.nome_campo, cca.nome_exibicao
             FROM equipamentos e
             LEFT JOIN equipamento_campos_adicionais eca ON e.id = eca.equipamento_id
             LEFT JOIN categoria_campos_adicionais cca ON eca.campo_id = cca.id
             WHERE e.id = ?`,
            [record.equipment_id]
          );

          const fallbackSnapshot = {
            nome: equipamentoAtual[0]?.nome || 'N/A',
            dono: equipamentoAtual[0]?.dono || 'N/A',
            setor: equipamentoAtual[0]?.setor || 'N/A',
            descricao: equipamentoAtual[0]?.descricao || 'N/A',
            cargo: equipamentoAtual[0]?.cargo || 'N/A',
            qrcode: equipamentoAtual[0]?.qrcode || 'N/A',
            categoria_id: equipamentoAtual[0]?.categoria_id,
            status_id: equipamentoAtual[0]?.status_id,
            additionalFields: {}
          };

          equipamentoAtual.forEach(eq => {
            if (eq.campo_id) {
              fallbackSnapshot.additionalFields[`campo_${eq.campo_id}`] = {
                valor: eq.valor || 'N/A',
                nome: eq.nome_exibicao || eq.nome_campo || `Campo ${eq.campo_id}`
              };
            }
          });

          snapshots[record.id] = fallbackSnapshot;
        }
      }

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

          // Monta diffs apenas para ações de update
          if (record.action === 'update') {
            const enrichedChanges = {};
            const changedFields = JSON.parse(record.changed_fields || '{}');

            for (const [key, value] of Object.entries(changedFields)) {
              if (ignoreKeys.includes(key)) continue;

              let nomeCampo = key;
              let oldValue = 'Não informado';
              let newValue = 'Não informado';

              if (value && typeof value === 'object' && value.de !== undefined && value.para !== undefined) {
                oldValue = value.de;
                newValue = value.para;
              }

              if (key.startsWith("campo_")) {
                // Para campos adicionais, usar o nome correto da tabela categoria_campos_adicionais
                const campoId = key.split("_")[1];
                const [campoInfo] = await db.query(
                  'SELECT nome_exibicao FROM categoria_campos_adicionais WHERE id = ?',
                  [campoId]
                );
                nomeCampo = campoInfo.length > 0 ? campoInfo[0].nome_exibicao : `Campo adicional ${campoId}`;
              }

              // Só adiciona se os valores são realmente diferentes
              if (String(oldValue).trim() !== String(newValue).trim()) {
                enrichedChanges[key] = {
                  campo: nomeCampo,
                  de: oldValue,
                  para: newValue
                };
              }
            }

            record.changed_fields = JSON.stringify(enrichedChanges);
          }
        } catch (e) {
          console.log('Current Snapshot:', currentSnapshot);
          console.log('Previous Snapshot:', prevSnapshot);
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