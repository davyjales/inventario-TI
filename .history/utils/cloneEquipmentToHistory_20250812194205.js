const db = require('../config/db');

/**
 * Clones the full equipment data into equipment_history as a new version.
 * @param {object} connection - Database connection.
 * @param {number} equipmentId - Equipment ID.
 * @param {string} action - Action type: 'create', 'update', 'delete'.
 * @param {string} userId - User ID performing the action.
 */
async function cloneEquipmentToHistory(connection, equipmentId, action, userId) {
  // Fetch full equipment data including additional fields
  const [equipments] = await connection.query(
    `SELECT e.*, c.nome AS categoria_nome, s.nome AS status_nome
     FROM equipamentos e
     LEFT JOIN categorias c ON e.categoria_id = c.id
     LEFT JOIN status_equipamentos s ON e.status_id = s.id
     WHERE e.id = ?`,
    [equipmentId]
  );

  if (equipments.length === 0) {
    // Equipment not found, do not insert history
    return;
  }

  const equipment = equipments[0];

  // Fetch additional fields
  const [additionalFields] = await connection.query(
    'SELECT nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
    [equipmentId]
  );

  // Prepare a snapshot object to store in changed_fields
  const snapshot = {
    ...equipment,
    additionalFields: additionalFields.reduce((acc, field) => {
      acc[field.nome_campo] = field.valor;
      return acc;
    }, {})
  };

  // Insert into equipment_history with full snapshot as changed_fields
  await connection.query(
    `INSERT INTO equipment_history (equipment_id, action, changed_fields, user_id)
     VALUES (?, ?, ?, ?)`,
    [equipmentId, action, JSON.stringify(snapshot), userId]
  );
}

module.exports = cloneEquipmentToHistory;
