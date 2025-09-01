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

    // Buscar categoria_id do equipamento
    let categoriaId = null;
    if (record.equipment_id) {
      const [equipRows] = await db.query(
        'SELECT categoria_id FROM equipamentos WHERE id = ?',
        [record.equipment_id]
      );
      if (equipRows.length > 0) {
        categoriaId = equipRows[0].categoria_id;
      }
    }

    // Criar mapa de nome_campo -> nome_exibicao
    let campoAdicionalMap = {};
    if (categoriaId) {
      const [camposAdicionais] = await db.query(
        'SELECT nome_exibicao, id FROM categoria_campos_adicionais WHERE categoria_id = ?',
        [categoriaId]
      );
      // Buscar também o nome_campo real em equipamento_campos_adicionais
      for (const campo of camposAdicionais) {
        const [nomeCampoRows] = await db.query(
          'SELECT DISTINCT nome_campo FROM equipamento_campos_adicionais WHERE campo_id = ?',
          [campo.id]
        );
        if (nomeCampoRows.length > 0) {
          campoAdicionalMap[nomeCampoRows[0].nome_campo] = campo.nome_exibicao;
        }
      }
    }

    // Status
    if (changedFields['status_id']) {
      const change = changedFields['status_id'];
      const [statusRowsDe] = await db.query(
        'SELECT nome FROM status_equipamentos WHERE id = ?',
        [change.de]
      );
      const [statusRowsPara] = await db.query(
        'SELECT nome FROM status_equipamentos WHERE id = ?',
        [change.para]
      );
      enrichedChanges['Status'] = {
        de: statusRowsDe.length > 0 ? statusRowsDe[0].nome : change.de,
        para: statusRowsPara.length > 0 ? statusRowsPara[0].nome : change.para
      };
    }

    // Cargo
    if (changedFields['cargo']) {
      enrichedChanges['Cargo'] = {
        de: changedFields['cargo'].de,
        para: changedFields['cargo'].para
      };
    }

    // Demais campos
    for (const [field, change] of Object.entries(changedFields)) {
      if (field === 'status_id' || field === 'cargo') continue;

      // Nome de exibição
      let nomeExibicao = campoAdicionalMap[field] || field;

      // Usar valores diretamente do histórico
      enrichedChanges[nomeExibicao] = {
        de: change.de,
        para: change.para
      };
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
