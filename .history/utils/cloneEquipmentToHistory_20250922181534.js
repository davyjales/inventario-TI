// utils/cloneEquipmentToHistory.js
const db = require('../config/db');

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
    const displayName = campo.campo_id
      ? campoIdToDisplayName[campo.campo_id]
      : campo.nome_campo;

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

  // Para create e consulta, salvar o snapshot completo no changed_fields
  // Para update, salvar apenas as mudanças (snapshot será construído dinamicamente)
  if (action === 'create' || action === 'consulta') {
    await connection.query(
      `INSERT INTO equipment_history (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(snapshot), userId]
    );
  } else if (action === 'update') {
    // Para update, filtrar apenas mudanças reais (similar ao logEquipmentChange)
    const mudancasReais = {};

    // Filtrar campos principais que realmente mudaram
    const camposPrincipais = ['categoria_id', 'nome', 'dono', 'setor', 'descricao', 'status_id', 'cargo', 'termo'];
    camposPrincipais.forEach(campo => {
      if (snapshot.hasOwnProperty(campo)) {
        const oldValue = snapshot[campo];
        const newValue = snapshot[campo]; // Para update, o snapshot já contém o estado novo

        // Comparação mais robusta
        if (oldValue === null || oldValue === undefined || oldValue === '') {
          if (newValue !== null && newValue !== undefined && newValue !== '') {
            mudancasReais[campo] = {
              de: oldValue ?? 'Não informado',
              para: newValue ?? 'Não informado'
            };
          }
        } else if (newValue === null || newValue === undefined || newValue === '') {
          if (oldValue !== null && oldValue !== undefined && oldValue !== '') {
            mudancasReais[campo] = {
              de: oldValue ?? 'Não informado',
              para: newValue ?? 'Não informado'
            };
          }
        } else {
          // Comparação normal para valores válidos
          const oldStr = String(oldValue).trim();
          const newStr = String(newValue).trim();

          if (oldStr !== newStr) {
            mudancasReais[campo] = {
              de: oldValue ?? 'Não informado',
              para: newValue ?? 'Não informado'
            };
          }
        }
      }
    });

    // Filtrar campos adicionais que realmente mudaram
    if (snapshot.additionalFields) {
      Object.entries(snapshot.additionalFields).forEach(([campoId, valor]) => {
        // Para campos adicionais, assumimos que se estão no snapshot é porque mudaram
        // O campo_id será usado para buscar o nome_exibicao correto no historicoService
        mudancasReais[`campo_${campoId}`] = {
          de: 'Não informado', // Para campos adicionais, não temos o valor anterior facilmente
          para: valor ?? 'Não informado'
        };
      });
    }

    // Só salvar se houver mudanças reais
    if (Object.keys(mudancasReais).length > 0) {
      await connection.query(
        `INSERT INTO equipment_history (equipment_id, action, changed_fields, user_id)
         VALUES (?, ?, ?, ?)`,
        [equipmentId, action, JSON.stringify(mudancasReais), userId]
      );
    }
  }
}

module.exports = cloneEquipmentToHistory;