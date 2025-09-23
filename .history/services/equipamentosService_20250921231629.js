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

      // Clonar snapshot inicial no histórico
      await cloneEquipmentToHistory(connection, equipamentoId, 'create', req.user.id);

      // Inserir campos adicionais (usando campo_id)
      if (additionalFields) {
        let campos;
        try {
          campos = JSON.parse(additionalFields);
        } catch {
          campos = [];
        }

        if (campos.length > 0) {
          const values = campos.map(f => [equipamentoId, f.name, f.value]); // f.name = campo_id
          await connection.query(
            'INSERT INTO equipamento_campos_adicionais (equipamento_id, campo_id, valor) VALUES ?',
            [values]
          );
        }
      }

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
      const [camposCategorias] = await db.query(
        'SELECT id, nome_exibicao FROM categoria_campos_adicionais'
      );

      const campoIdToDisplayName = {};
      camposCategorias.forEach(campo => {
        campoIdToDisplayName[campo.id] = campo.nome_exibicao;
      });

      const [equipamentos] = await db.query(query, values);

      const equipamentosComCampos = await Promise.all(
        equipamentos.map(async eq => {
          const [campos] = await db.query(
            'SELECT campo_id, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
            [eq.id]
          );

          eq.additionalFields = {};
          campos.forEach(c => {
            const key = String(c.campo_id);
            const displayName = campoIdToDisplayName[key] || `Campo ${key}`;
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
        'SELECT campo_id, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );

      equipamento.additionalFields = {};
      campos.forEach(c => {
        equipamento.additionalFields[String(c.campo_id)] = c.valor;
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

      const oldState = await getCurrentEquipmentState(connection, id);

      const [categoriaCampos] = await connection.query('SELECT id, nome_exibicao FROM categoria_campos_adicionais');
      const campoIdToDisplayName = {};
      categoriaCampos.forEach(c => { campoIdToDisplayName[c.id] = c.nome_exibicao; });

      const [oldCamposRows] = await connection.query(
        'SELECT campo_id, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );
      const oldAdditional = {};
      oldCamposRows.forEach(r => {
        const key = String(r.campo_id);
        oldAdditional[key] = { valor: r.valor, nome: campoIdToDisplayName[r.campo_id] || `Campo ${key}` };
      });

      const camposPermitidos = ['categoria_id', 'nome', 'dono', 'setor', 'descricao', 'status_id', 'cargo'];
      const newState = { ...oldState };
      camposPermitidos.forEach(campo => {
        if (req.body[campo] !== undefined) newState[campo] = req.body[campo];
      });

      newState.termo = req.file ? req.file.filename :
                       (req.body.removerTermo === 'true' ? null : oldState.termo);

      const changes = {};
      const camposParaComparar = [...camposPermitidos, 'termo'];
      camposParaComparar.forEach(key => {
        if (req.body[key] !== undefined || key === 'termo') {
          const oldValue = oldState[key];
          const newValue = newState[key];

          if (String(oldValue || '').trim() !== String(newValue || '').trim()) {
            changes[key] = {
              de: oldValue ?? 'Não informado',
              para: newValue ?? 'Não informado'
            };
          }
        }
      });

      const newAdditional = {};
      if (req.body.additionalFields) {
        try {
          const parsed = JSON.parse(req.body.additionalFields);
          if (Array.isArray(parsed)) {
            parsed.forEach(f => {
              const key = String(f.name);
              newAdditional[key] = { valor: f.value, nome: campoIdToDisplayName[key] || `Campo ${key}` };
            });
          }
        } catch {}
      }

      const allCampoKeys = new Set([ ...Object.keys(oldAdditional), ...Object.keys(newAdditional) ]);
      for (const campoKey of allCampoKeys) {
        const oldVal = oldAdditional[campoKey]?.valor ?? null;
        const newVal = newAdditional[campoKey]?.valor ?? null;

        if (String(oldVal) !== String(newVal)) {
          changes[`campo_${campoKey}`] = {
            campo: campoIdToDisplayName[campoKey] || `Campo ${campoKey}`,
            de: oldVal ?? 'Não informado',
            para: newVal ?? 'Não informado'
          };
        }
      }

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

      if (req.body.additionalFields) {
        try {
          const camposAdicionais = JSON.parse(req.body.additionalFields);
          if (Array.isArray(camposAdicionais)) {
            await connection.query(
              'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
              [id]
            );

            if (camposAdicionais.length > 0) {
              const values = camposAdicionais.map(f => [id, f.name, f.value]);
              await connection.query(
                'INSERT INTO equipamento_campos_adicionais (equipamento_id, campo_id, valor) VALUES ?',
                [values]
              );
            }
          }
        } catch (e) {
          throw new Error('Formato inválido para campos adicionais');
        }
      }

      if (Object.keys(changes).length > 0) {
        await logEquipmentChange(connection, id, 'update', changes, userId);
      }

      await cloneEquipmentToHistory(connection, id, 'update', userId);

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

      const [equipment] = await connection.query(
        'SELECT id FROM equipamentos WHERE id = ?',
        [equipmentId]
      );

      if (equipment.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: 'Equipamento não encontrado.' });
      }

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
