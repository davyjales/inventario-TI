// utils/cloneEquipmentToHistory.js
const db = require('../config/db');

/**
 * Clones the equipment data into equipment_history as a new version,
 * storing the full snapshot of the equipment state.
 */
async function cloneEquipmentToHistory(connection, equipmentId, action, userId) {
  // Buscar dados principais do equipamento
  const [equipments] = await connection.query(
    `SELECT e.*, c.nome AS categoria_nome, s.nome AS status_nome
     FROM equipamentos e
     LEFT JOIN categorias c ON e.categoria_id = c.id
     LEFT JOIN status_equipamentos s ON e.status_id = s.id
     WHERE e.id = ?`,
    [equipmentId]
  );

  if (!equipments || equipments.length === 0) {
    return;
  }

  const equipment = equipments[0];

  // Buscar todos os campos adicionais da categoria
  const [camposCategoria] = await connection.query(
    'SELECT id, nome_exibicao FROM categoria_campos_adicionais WHERE categoria_id = ?',
    [equipment.categoria_id]
  );

  // Buscar valores preenchidos para este equipamento
  const [camposEquipamento] = await connection.query(
    'SELECT campo_id, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
    [equipmentId]
  );

  const valoresMap = {};
  camposEquipamento.forEach(c => {
    valoresMap[c.campo_id] = c.valor;
  });

  // Montar objeto final de campos adicionais
  const additionalFieldsObj = {};
  camposCategoria.forEach(c => {
    additionalFieldsObj[c.id] = {
      valor: valoresMap[c.id] || null,
      nome: c.nome_exibicao
    };
  });

  const snapshot = {
    ...equipment,
    dono: equipment.dono,
    additionalFields: additionalFieldsObj
  };

  await connection.query(
    `INSERT INTO equipment_history (equipment_id, action, changed_fields, user_id)
     VALUES (?, ?, ?, ?)`,
    [equipmentId, action, JSON.stringify(snapshot), userId]
  );
}

module.exports = cloneEquipmentToHistory;
