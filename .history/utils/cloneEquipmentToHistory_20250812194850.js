const db = require('../config/db');

function deepDiff(obj1, obj2) {
  const diff = {};
  for (const key in obj2) {
    if (typeof obj2[key] === 'object' && obj2[key] !== null && !Array.isArray(obj2[key])) {
      const nestedDiff = deepDiff(obj1[key] || {}, obj2[key]);
      if (Object.keys(nestedDiff).length > 0) {
        diff[key] = nestedDiff;
      }
    } else if (Array.isArray(obj2[key])) {
      // For arrays, do a simple JSON string comparison
      if (JSON.stringify(obj1[key]) !== JSON.stringify(obj2[key])) {
        diff[key] = obj2[key];
      }
    } else {
      if (obj1[key] !== obj2[key]) {
        diff[key] = obj2[key];
      }
    }
  }
  return diff;
}

/**
 * Clones the equipment data into equipment_history as a new version,
 * storing only the changed fields compared to the last version.
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

  // Fetch last history version for this equipment
  const [lastHistory] = await connection.query(
    `SELECT changed_fields FROM equipment_history
     WHERE equipment_id = ?
     ORDER BY timestamp DESC
     LIMIT 1`,
    [equipmentId]
  );

  let lastSnapshot = {};
  if (lastHistory.length > 0) {
    try {
      lastSnapshot = JSON.parse(lastHistory[0].changed_fields);
    } catch {
      lastSnapshot = {};
    }
  }

  let changedFields = {};
  if (action === 'create') {
    // On create, store full snapshot as all fields are new
    changedFields = snapshot;
  } else if (action === 'delete') {
    // On delete, store empty changes or minimal info
    changedFields = {};
  } else {
    // On update, store only diff between last snapshot and current snapshot
    changedFields = deepDiff(lastSnapshot, snapshot);
  }

  // Insert into equipment_history with changed fields
  if (Object.keys(changedFields).length > 0 || action === 'delete') {
    await connection.query(
      `INSERT INTO equipment_history (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(changedFields), userId]
    );
  }
}

module.exports = cloneEquipmentToHistory;
