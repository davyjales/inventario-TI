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

      // ---------- snapshots históricos ----------
      const snapshots = {};

      // Para cada registro de histórico, construir o snapshot correto
      for (let i = 0; i < historico.length; i++) {
        const record = historico[i];
        try {
          const changedFields = JSON.parse(record.changed_fields || '{}');

          if (record.action === 'consulta' || record.action === 'create') {
            // Para consulta e create, o changed_fields contém o snapshot completo
            snapshots[record.id] = changedFields;
          } else if (record.action === 'update') {
            // Para update, se changed_fields estiver vazio, buscar estado atual
            if (Object.keys(changedFields).length === 0) {
              // Buscar estado atual do equipamento
              const [equipamentoAtual] = await db.query(
                `SELECT e.*, c.nome AS categoria_nome, s.nome AS status_nome
                 FROM equipamentos e
                 LEFT JOIN categorias c ON e.categoria_id = c.id
                 LEFT JOIN status_equipamentos s ON e.status_id = s.id
                 WHERE e.id = ?`,
                [record.equipment_id]
              );

              if (equipamentoAtual.length > 0) {
                const equipment = equipamentoAtual[0];

                // Buscar campos adicionais
                const [camposEquipamento] = await db.query(
                  'SELECT campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
                  [record.equipment_id]
                );

                const [camposCategoria] = await db.query(
                  'SELECT id, nome_exibicao FROM categoria_campos_adicionais WHERE categoria_id = ?',
                  [equipment.categoria_id]
                );

                const campoIdToDisplayName = {};
                camposCategoria.forEach(campo => {
                  campoIdToDisplayName[campo.id] = campo.nome_exibicao;
                });

                const additionalFieldsObj = {};
                camposEquipamento.forEach(campo => {
                  const displayName = campo.campo_id
                    ? campoIdToDisplayName[campo.campo_id]
                    : campo.nome_campo;

                  if (displayName) {
                    additionalFieldsObj[displayName] = campo.valor || null;
                  }
                });

                camposCategoria.forEach(campo => {
                  if (!additionalFieldsObj.hasOwnProperty(campo.nome_exibicao)) {
                    additionalFieldsObj[campo.nome_exibicao] = null;
                  }
                });

                snapshots[record.id] = {
                  ...equipment,
                  dono: equipment.dono,
                  additionalFields: additionalFieldsObj
                };
              } else {
                snapshots[record.id] = {
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
              }
            } else {
              // Se changed_fields não estiver vazio, usar como snapshot
              snapshots[record.id] = changedFields;
            }
          }
        } catch (e) {
          console.error('Erro ao construir snapshots:', e);
          // Fallback: buscar estado atual do equipamento
          try {
            const [equipamentoAtual] = await db.query(
              `SELECT e.*, c.nome AS categoria_nome, s.nome AS status_nome
               FROM equipamentos e
               LEFT JOIN categorias c ON e.categoria_id = c.id
               LEFT JOIN status_equipamentos s ON e.status_id = s.id
               WHERE e.id = ?`,
              [record.equipment_id]
            );

            if (equipamentoAtual.length > 0) {
              const equipment = equipamentoAtual[0];

              // Buscar campos adicionais
              const [camposEquipamento] = await db.query(
                'SELECT campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
                [record.equipment_id]
              );

              const [camposCategoria] = await db.query(
                'SELECT id, nome_exibicao FROM categoria_campos_adicionais WHERE categoria_id = ?',
                [equipment.categoria_id]
              );

              const campoIdToDisplayName = {};
              camposCategoria.forEach(campo => {
                campoIdToDisplayName[campo.id] = campo.nome_exibicao;
              });

              const additionalFieldsObj = {};
              camposEquipamento.forEach(campo => {
                const displayName = campo.campo_id
                  ? campoIdToDisplayName[campo.campo_id]
                  : campo.nome_campo;

                if (displayName) {
                  additionalFieldsObj[displayName] = campo.valor || null;
                }
              });

              camposCategoria.forEach(campo => {
                if (!additionalFieldsObj.hasOwnProperty(campo.nome_exibicao)) {
                  additionalFieldsObj[campo.nome_exibicao] = null;
                }
              });

              snapshots[record.id] = {
                ...equipment,
                dono: equipment.dono,
                additionalFields: additionalFieldsObj
              };
            } else {
              snapshots[record.id] = {
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
            }
          } catch (fallbackError) {
            console.error('Erro no fallback:', fallbackError);
            snapshots[record.id] = {
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
          }
        }
      }

      // ---------- monta diffs ---------- 
      // Add current additional fields to the record
      /*for (const record of historico) {
        record.current_additionalFields = camposPorEquipamento[record.equipment_id] || {};
      }*/
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