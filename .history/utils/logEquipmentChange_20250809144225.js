module.exports = async function logEquipmentChange(connection, equipmentId, action, changes, userId) {
  const mudancasReais = Object.entries(changes)
    .filter(([_, v]) => v.de !== v.para)
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  if (Object.keys(mudancasReais).length > 0) {
    await connection.query(
      `INSERT INTO equipment_history 
       (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(mudancasReais), userId]
    );
  }
};
