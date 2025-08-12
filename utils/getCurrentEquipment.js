module.exports = async function getCurrentEquipmentState(connection, equipmentId) {
  const query = "SELECT id, categoria_id, nome, dono, setor, descricao, termo, qrCode, hostname, status_id " +
                "FROM equipamentos " +
                "WHERE id = ?";
  const [results] = await connection.query(query, [equipmentId]);
  if (results.length === 0) throw new Error('Equipamento não encontrado');
  return results[0];
};
