// utils/cloneEquipmentToHistory.js
const db = require('../config/db');

/**
 * Clones the equipment data into equipment_history as a new version,
 * storing the full snapshot of the equipment state.
 */
async function cloneEquipmentToHistory(connection, equipmentId, action, userId) {
  // Fetch full equipment data including cargo, nomes de categoria/status
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

  // Fetch additional fields including potential campo_id
  const [additionalFields] = await connection.query(
    'SELECT id, campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
    [equipmentId]
  );

  // Build additionalFields object with normalized keys (prefer campo_id)
  const additionalFieldsObj = (additionalFields || []).reduce((acc, field) => {
    let key;
    if (field.campo_id !== undefined && field.campo_id !== null) {
      key = String(field.campo_id); // prefer numeric id if present
    } else if (field.nome_campo && !isNaN(Number(field.nome_campo))) {
      key = String(Number(field.nome_campo)); // nome_campo contém id numérico como string
    } else {
      // fallback: ensure unique predictable key so frontend can still show it
      key = `nome_${field.id}`;
    }

    acc[key] = { valor: field.valor, nome: field.nome_campo };
    return acc;
  }, {});

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
