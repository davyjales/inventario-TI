const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const db = require('../config/db');
const logEquipmentChange = require('../utils/logEquipmentChange');
const getCurrentEquipmentState = require('../utils/getCurrentEquipment');
const cloneEquipmentToHistory = require('../utils/cloneEquipmentToHistory');

module.exports = {
  // Criar equipamento
  async criarEquipamento(req, res) {
    const { categoria_id, nome, dono, setor, descricao, status_id, cargo, additionalFields } = req.body;
    console.log("Received payload:", req.body);
    const termo = req.file ? req.file.filename : null;

    if (!categoria_id || !nome || !dono || !setor) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const identificador = uuidv4();
    const nomeQRCode = `${categoria_id}_${identificador}.png`.replace(/\s/g, '_');
    const caminhoQRCode = path.join(__dirname, '../uploads', nomeQRCode);

    let connection;
    try {
      await QRCode.toFile(caminhoQRCode, identificador, { width: 300, margin: 2 });

      connection = await db.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.query(
        `INSERT INTO equipamentos 
         (categoria_id, nome, dono, setor, descricao, termo, qrCode, status_id, cargo) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [categoria_id, nome, dono, setor, descricao, termo, nomeQRCode, status_id || 1, cargo || null]
      );

      const equipamentoId = result.insertId;

      // Salvar campos adicionais primeiro
      if (additionalFields) {
        let campos;
        try {
          campos = JSON.parse(additionalFields);
        } catch {
          campos = [];
        }
        
        if (campos.length > 0) {
          const values = campos.map(f => [equipamentoId, f.name, f.value]);
          await connection.query(
            'INSERT INTO equipamento_campos_adicionais (equipamento_id, campo_id, valor) VALUES ?',
            [values]
          );
        }
      }

      // Só depois clonar para o histórico
      await cloneEquipmentToHistory(connection, equipamentoId, 'create', req.user.id);

      await connection.commit();
      res.status(201).json({ message: 'Equipamento cadastrado com sucesso!', id: equipamentoId });
    } catch (err) {
      if (connection) {
        await connection.rollback();
        connection.release();
      }
      console.error('Erro no cadastro de equipamento:', err);
      res.status(500).json({ error: err.message });
    } finally {
      if (connection) connection.release();
    }
  },

  // Buscar equipamento pelo qrCode
  async buscarEquipamentoPorQrCode(req, res) {
    let { code } = req.params;

    try {
      // Se não tiver ".png", adiciona para compatibilidade
      if (!code.endsWith(".png")) {
        code = code + ".png";
      }

      const [results] = await db.query(
        `SELECT e.id, e.categoria_id, e.nome, e.dono, e.setor, e.descricao, e.termo, e.qrCode, e.hostname, e.status_id, e.cargo,
                c.nome AS categoria, c.recebe_termo AS categoria_recebe_termo,
                s.nome AS status
        FROM equipamentos e
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN status_equipamentos s ON e.status_id = s.id
        WHERE e.qrCode = ?`,
        [code]
      );

      if (results.length === 0) {
        return res.status(404).json({ error: 'Equipamento não encontrado.' });
      }

      res.json(results[0]);
    } catch (err) {
      console.error('Erro ao buscar por qrCode:', err);
      res.status(500).json({ error: 'Erro ao buscar equipamento.' });
    }
  },

  // Listar equipamentos
 async listarEquipamentos(req, res) {
  const { hostname, status } = req.query;
  let query = `
    SELECT e.id, e.categoria_id, e.nome, e.dono, e.setor, e.descricao, e.termo, e.qrCode, e.hostname, e.status_id, e.cargo,
           c.nome AS categoria, c.recebe_termo AS categoria_recebe_termo, s.nome AS status_nome
    FROM equipamentos e
    LEFT JOIN categorias c ON e.categoria_id = c.id
    LEFT JOIN status_equipamentos s ON e.status_id = s.id
    WHERE 1=1
  `;
  const values = [];

  if (hostname) {
    query += ' AND e.hostname LIKE ?';
    values.push(`%${hostname}%`);
  }

  if (status) {
    query += ' AND e.status_id = ?';
    values.push(status);
  }

  try {
    // Fetch categories and their additional fields metadata
    const [camposCategorias] = await db.query(
      'SELECT id, nome_exibicao FROM categoria_campos_adicionais'
    );

    // Build mapping from campo_id (or id) to display name
    const campoIdToDisplayName = {};
    camposCategorias.forEach(campo => {
      campoIdToDisplayName[campo.id] = campo.nome_exibicao;
    });

    const [equipamentos] = await db.query(query, values);

    const equipamentosComCampos = await Promise.all(
      equipamentos.map(async eq => {
        // pegar campo_id quando existir
        const [campos] = await db.query(
          'SELECT id, campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
          [eq.id]
        );

        eq.additionalFields = {};
        campos.forEach(c => {
          // chave preferida: campo_id -> se não, tentar converter nome_campo numérico -> senão usar nome_campo
          const key = (c.campo_id !== undefined && c.campo_id !== null)
            ? String(c.campo_id)
            : (c.nome_campo && !isNaN(Number(c.nome_campo)) ? String(Number(c.nome_campo)) : c.nome_campo);

          const displayName = campoIdToDisplayName[key] || c.nome_campo;
          eq.additionalFields[displayName] = c.valor;
        });

        return eq;
      })
    );

    res.json(equipamentosComCampos);
  } catch (err) {
    console.error('Erro ao buscar equipamentos:', err);
    res.status(500).json({ error: 'Erro ao buscar equipamentos' });
  }
},

  // Buscar equipamento por ID
  async buscarEquipamentoPorId(req, res) {
    const { id } = req.params;

    try {
      const [results] = await db.query(
        `SELECT e.id, e.categoria_id, e.nome, e.dono, e.setor, e.descricao, e.termo, e.qrCode, e.hostname, e.status_id, e.cargo,
                c.nome AS categoria, c.recebe_termo AS categoria_recebe_termo,
                s.nome AS status
        FROM equipamentos e
        LEFT JOIN categorias c ON e.categoria_id = c.id
        LEFT JOIN status_equipamentos s ON e.status_id = s.id
        WHERE e.id = ?`,
        [id]
      );

      if (results.length === 0) {
        return res.status(404).json({ error: 'Equipamento não encontrado.' });
      }

      const equipamento = results[0];

      const [campos] = await db.query(
        'SELECT id, campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );

      equipamento.additionalFields = {};
      campos.forEach(c => {
        const key = (c.campo_id !== undefined && c.campo_id !== null)
          ? String(c.campo_id)
          : (c.nome_campo && !isNaN(Number(c.nome_campo)) ? String(Number(c.nome_campo)) : c.nome_campo);
        equipamento.additionalFields[key] = c.valor;
      });

      res.json(equipamento);
    } catch (err) {
      console.error('Erro ao buscar equipamento:', err);
      res.status(500).json({ error: 'Erro ao buscar equipamento.' });
    }
  },

  // Atualizar equipamento
  async atualizarEquipamento(req, res) {
    const { id } = req.params;
    const userId = req.user.id;
    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // --- mapa de nomes de campos adicionais (categoria_campos_adicionais) ---
      const [categoriaCampos] = await connection.query('SELECT id, nome_exibicao FROM categoria_campos_adicionais');
      const campoIdToDisplayName = {};
      categoriaCampos.forEach(c => { campoIdToDisplayName[c.id] = c.nome_exibicao; });

      // --- busca campos adicionais atuais do equipamento ---
      const [oldCamposRows] = await connection.query(
        'SELECT campo_id, nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );
      const oldAdditional = {};
      oldCamposRows.forEach(r => {
        // lidar com possível inconsistência: se houver campo_id use ele, senão nome_campo
        const key = (r.campo_id !== undefined && r.campo_id !== null) ? String(r.campo_id) : String(r.nome_campo);
        oldAdditional[key] = { valor: r.valor, nome: (r.campo_id ? (campoIdToDisplayName[r.campo_id] || r.nome_campo) : r.nome_campo) };
      });

      // --- estado antigo (snapshot) - buscar ANTES de fazer qualquer alteração ---
      const oldState = await getCurrentEquipmentState(connection, id);

      // --- campos permitidos (campos principais) ---
      const camposPermitidos = ['categoria_id', 'nome', 'dono', 'setor', 'descricao', 'status_id', 'cargo'];
      const newState = { ...oldState };
      camposPermitidos.forEach(campo => {
        if (req.body[campo] !== undefined) newState[campo] = req.body[campo];
      });

      newState.termo = req.file ? req.file.filename :
                       (req.body.removerTermo === 'true' ? null : oldState.termo);

      // --- mudanças iniciais (campos principais + termo) ---
      const changes = {};
      const camposParaComparar = [...camposPermitidos, 'termo'];
      camposParaComparar.forEach(key => {
        if (req.body[key] !== undefined || key === 'termo') {
          const oldValue = oldState[key];
          const newValue = (key === 'termo')
            ? (req.file ? req.file.filename : (req.body.removerTermo === 'true' ? null : oldState.termo))
            : req.body[key];

          // Comparação mais robusta para detectar mudanças reais
          const oldStr = String(oldValue || '').trim();
          const newStr = String(newValue || '').trim();

          if (oldStr !== newStr) {
            changes[key] = {
              de: oldValue ?? 'Não informado',
              para: newValue ?? 'Não informado'
            };
          }
        }
      });

      // --- processar campos adicionais enviados no body (para comparação) ---
      const newAdditional = {};
      if (req.body.additionalFields) {
        try {
          const parsed = JSON.parse(req.body.additionalFields);
          if (Array.isArray(parsed)) {
            parsed.forEach(f => {
              // assumimos que f.name é o id do campo (ou identificador armazenado)
              const key = String(f.name);
              newAdditional[key] = { valor: f.value, nome: campoIdToDisplayName[key] || f.name };
            });
          }
        } catch (e) {
          // se parse falhar, segue sem campos adicionais
        }
      }

      // --- comparar oldAdditional x newAdditional e incluir no objeto changes como campo_<id> ---
      const additionalProvided = typeof req.body.additionalFields !== 'undefined';

  if (additionalProvided) {
  const allCampoKeys = new Set([ ...Object.keys(oldAdditional), ...Object.keys(newAdditional) ]);
  for (const campoKey of allCampoKeys) {
    const oldVal = oldAdditional[campoKey] ? oldAdditional[campoKey].valor : null;
    const newVal = newAdditional[campoKey] ? newAdditional[campoKey].valor : null;

    // Tratar null/undefined pra comparação coerente
    const oldStr = (oldVal === null || oldVal === undefined) ? '' : String(oldVal);
    const newStr = (newVal === null || newVal === undefined) ? '' : String(newVal);

    if (oldStr !== newStr) {
      changes[`campo_${campoKey}`] = {
        campo: campoIdToDisplayName[campoKey] || (oldAdditional[campoKey]?.nome) || (newAdditional[campoKey]?.nome) || `Campo ${campoKey}`,
        de: oldVal ?? 'Não informado',
        para: newVal ?? 'Não informado'
      };
    }
  }
}

      // --- Log para update do equipamento - fazer ANTES da alteração, mas com as mudanças calculadas ---
      await cloneEquipmentToHistory(connection, id, 'update', userId, changes);

      // --- executa UPDATE do equipamento (campos principais) ---
      await connection.query(
        `UPDATE equipamentos
         SET categoria_id = ?, nome = ?, dono = ?, setor = ?, descricao = ?,
             termo = ?, status_id = ?, cargo = ?
         WHERE id = ?`,
        [
          newState.categoria_id,
          newState.nome,
          newState.dono,
          newState.setor,
          newState.descricao,
          newState.termo,
          newState.status_id,
          newState.cargo,
          id
        ]
      );

      // --- atualiza campos adicionais (apagar e inserir novo conjunto) ---
      if (req.body.additionalFields) {
        try {
          const camposAdicionais = JSON.parse(req.body.additionalFields);
          if (Array.isArray(camposAdicionais)) {
            await connection.query(
              'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
              [id]
            );

            if (camposAdicionais.length > 0) {
               const values = camposAdicionais.map(campo => [id, campo.name, campo.value]);
               await connection.query(
              `INSERT INTO equipamento_campos_adicionais (equipamento_id, campo_id, valor)
                VALUES ?`,
              [values]
            );
          }
          }
        } catch (e) {
          throw new Error('Formato inválido para campos adicionais');
        }
      }

      await connection.commit();
      res.json({ success: true, message: 'Equipamento atualizado com sucesso', changes });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Erro na atualização:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      if (connection) connection.release();
    }
  },

  // Excluir equipamento
  async excluirEquipamento(req, res) {
    const { id } = req.params;
    let connection;

    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [equipment] = await connection.query(
        'SELECT * FROM equipamentos WHERE id = ?', 
        [id]
      );
      
      if (equipment.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Equipamento não encontrado' });
      }

      // Log para exclusão do equipamento
      // await logEquipmentChange(connection, id, 'delete', {}, req.user.id);
      await cloneEquipmentToHistory(connection, id, 'delete', req.user.id);

      await connection.query(
        'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );

      await connection.query(
        'DELETE FROM equipamentos WHERE id = ?',
        [id]
      );

      await connection.commit();
      res.json({ message: 'Equipamento excluído com sucesso.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Erro ao excluir equipamento:', error);
      res.status(500).json({ error: error.message });
    } finally {
      if (connection) connection.release();
    }
  },

  // Log consulta de equipamento
  async logConsulta(req, res) {
    const { equipmentId } = req.body;
    const userId = req.user.id;

    if (!equipmentId) {
      return res.status(400).json({ error: 'ID do equipamento é obrigatório.' });
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      // Verify equipment exists
      const [equipment] = await connection.query(
        'SELECT id FROM equipamentos WHERE id = ?',
        [equipmentId]
      );

      if (equipment.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Equipamento não encontrado.' });
      }

      // Log consultation
      // await logEquipmentChange(connection, equipmentId, 'consulta', null, userId);
      await cloneEquipmentToHistory(connection, equipmentId, 'consulta', userId);

      await connection.commit();
      res.json({ message: 'Consulta registrada com sucesso.' });
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Erro ao registrar consulta:', error);
      res.status(500).json({ error: error.message });
    } finally {
      if (connection) connection.release();
    }
  }
};
