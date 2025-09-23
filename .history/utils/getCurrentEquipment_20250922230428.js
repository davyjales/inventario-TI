// utils/getCurrentEquipment.js
module.exports = async function getCurrentEquipmentState(connection, equipmentId) {
  const query = `
    SELECT e.id, e.categoria_id, e.nome, e.dono, e.setor, e.descricao, e.termo, e.qrCode, e.hostname, e.status_id, e.cargo,
           c.nome AS categoria_nome, s.nome AS status_nome
    FROM equipamentos e
    LEFT JOIN categorias c ON e.categoria_id = c.id
    LEFT JOIN status_equipamentos s ON e.status_id = s.id
    WHERE e.id = ?
  `;
  const [results] = await connection.query(query, [equipmentId]);
  if (results.length === 0) throw new Error('Equipamento não encontrado');

  const equipment = results[0];

  // Buscar campos adicionais da categoria
  const [camposCategoria] = await connection.query(
    'SELECT id, nome_exibicao FROM categoria_campos_adicionais WHERE categoria_id = ?',
    [equipment.categoria_id]
  );

  // Criar mapa de campo_id para nome_exibicao
  const campoIdToDisplayName = {};
  camposCategoria.forEach(campo => {
    campoIdToDisplayName[campo.id] = campo.nome_exibicao;
  });

  // Buscar valores preenchidos para este equipamento
  const [camposEquipamento] = await connection.query(
    'SELECT campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
    [equipmentId]
  );

  // Montar objeto final de campos adicionais
  const additionalFieldsObj = {};
  camposEquipamento.forEach(campo => {
    let displayName = null;

    if (campo.campo_id && campoIdToDisplayName[campo.campo_id]) {
      displayName = campoIdToDisplayName[campo.campo_id];
    } else if (campo.nome_campo) {
      displayName = campo.nome_campo;
    }

    if (displayName) {
      additionalFieldsObj[displayName] = campo.valor || null;
    }
  });

  // Incluir campos da categoria que não foram preenchidos
  camposCategoria.forEach(campo => {
    if (!additionalFieldsObj.hasOwnProperty(campo.nome_exibicao)) {
      additionalFieldsObj[campo.nome_exibicao] = null;
    }
  });

  return {
    ...equipment,
    additionalFields: additionalFieldsObj
  };
};
