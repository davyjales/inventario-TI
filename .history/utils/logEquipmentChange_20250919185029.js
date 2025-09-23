module.exports = async function logEquipmentChange(connection, equipmentId, action, changes, userId) {
  // Para ações que não são update, sempre loga (create, delete, consulta)
  if (action === 'create' || action === 'delete' || action === 'consulta') {
    await connection.query(
      `INSERT INTO equipment_history
       (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(changes || {}), userId]
    );
    return;
  }

  // Para update, filtra apenas mudanças reais
  const mudancasReais = Object.entries(changes || {})
    .filter(([key, value]) => {
      // Ignora campos que não são mudanças reais
      if (!value || typeof value !== 'object') return false;

      const oldValue = value.de;
      const newValue = value.para;

      // Comparação mais robusta
      if (oldValue === null || oldValue === undefined || oldValue === '') {
        return newValue !== null && newValue !== undefined && newValue !== '';
      }

      if (newValue === null || newValue === undefined || newValue === '') {
        return oldValue !== null && oldValue !== undefined && oldValue !== '';
      }

      // Comparação normal para valores válidos
      return String(oldValue).trim() !== String(newValue).trim();
    })
    .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

  // Só loga se houver mudanças reais
  if (Object.keys(mudancasReais).length > 0) {
    await connection.query(
      `INSERT INTO equipment_history
       (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(mudancasReais), userId]
    );
  }
};
