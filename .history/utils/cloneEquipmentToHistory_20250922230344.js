// utils/cloneEquipmentToHistory.js
const db = require('../config/db');

async function cloneEquipmentToHistory(connection, equipmentId, action, userId, changes = null) {
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

  // Buscar todos os campos adicionais da categoria com seus nomes de exibição
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

  // Montar objeto final de campos adicionais usando nome_exibicao como chave
  const additionalFieldsObj = {};
  camposEquipamento.forEach(campo => {
    // Priorizar campo_id para encontrar o nome_exibicao correto
    let displayName = null;

    if (campo.campo_id && campoIdToDisplayName[campo.campo_id]) {
      displayName = campoIdToDisplayName[campo.campo_id];
    } else if (campo.nome_campo) {
      // Se não encontrou pelo campo_id, tentar usar nome_campo diretamente
      displayName = campo.nome_campo;
    }

    if (displayName) {
      additionalFieldsObj[displayName] = campo.valor || null;
    }
  });

  // Incluir também campos da categoria que não foram preenchidos (com valor null)
  camposCategoria.forEach(campo => {
    if (!additionalFieldsObj.hasOwnProperty(campo.nome_exibicao)) {
      additionalFieldsObj[campo.nome_exibicao] = null;
    }
  });

  const snapshot = {
    ...equipment,
    dono: equipment.dono,
    additionalFields: additionalFieldsObj
  };

  // NOVO FLUXO: Separação entre snapshot e changed_fields
  let changedFieldsToSave = {};
  let snapshotToSave = null;

  if (action === 'create' || action === 'consulta') {
    // Para create e consulta: snapshot = estado completo, changed_fields = vazio
    snapshotToSave = snapshot;
    changedFieldsToSave = {};
  } else if (action === 'update') {
    // Para update: snapshot = estado completo antes da mudança, changed_fields = diferenças
    snapshotToSave = snapshot;
    changedFieldsToSave = changes || {};
  } else if (action === 'delete') {
    // Para delete: snapshot = último estado, changed_fields = vazio
    snapshotToSave = snapshot;
    changedFieldsToSave = {};
  }

  // Salvar no banco com as novas colunas
  await connection.query(
    `INSERT INTO equipment_history (equipment_id, action, changed_fields, snapshot, user_id)
     VALUES (?, ?, ?, ?, ?)`,
    [equipmentId, action, JSON.stringify(changedFieldsToSave), JSON.stringify(snapshotToSave), userId]
  );
}

module.exports = cloneEquipmentToHistory;