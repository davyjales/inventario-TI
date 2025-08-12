module.exports = async function getCurrentEquipmentState(connection, equipmentId) {
  const [results] = await connection.query(
    `SELECT id, categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status
     FROM equipamentos
     WHERE id = ?`,
    [equipmentId]
  );
  if (results.length === 0) throw new Error('Equipamento não encontrado');
  return results[0];
};
