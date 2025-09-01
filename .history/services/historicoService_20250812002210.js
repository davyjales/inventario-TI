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

      for (const record of historico) {
  try {
    const changedFields = JSON.parse(record.changed_fields || '{}');
    const enrichedChanges = {};

    // STATUS
    if (changedFields['status_id']) {
      const change = changedFields['status_id'];
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
    }

    // CARGO
    if (changedFields['cargo']) {
      enrichedChanges['Cargo'] = {
        de: changedFields['cargo'].de,
        para: changedFields['cargo'].para
      };
    }

    // DEMAIS CAMPOS
    for (const [field, change] of Object.entries(changedFields)) {
      if (field === 'status_id' || field === 'cargo') continue;

      if (field === 'categoria') {
        // Busca nome_exibicao e valores antigos/novos em uma única query
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
        } else {
          enrichedChanges['Categoria'] = { de: change.de, para: change.para };
        }
      } 
      else {
        // Verifica se é um campo adicional
        const [extraField] = await db.query(
          `SELECT nome_exibicao 
           FROM categoria_campos_adicionais 
           WHERE id = ? LIMIT 1`,
          [field]
        );

        if (extraField.length > 0) {
          // Campo adicional encontrado — buscar valores antigo e novo
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
        } else {
          // Campo comum
          enrichedChanges[field] = {
            de: change.de,
            para: change.para
          };
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
