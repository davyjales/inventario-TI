const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const SECRET = 'segredo_supersecreto';

// Configuração do pool de conexões
const db = mysql.createPool({
  host: '10.137.174.45',
  user: 'suporte',
  password: 'InicioOK2015',
  database: 'inventario_visteon',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middlewares
app.use(cors());
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware de autenticação
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ erro: 'Token ausente' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.user = user;
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (!req.user.admin) return res.status(403).json({ erro: 'Acesso negado' });
  next();
}

function verificarInventarianteOuAdmin(req, res, next) {
  if (!req.user.admin && !req.user.inventariante) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Configuração de upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
const termoUpload = upload.single('termo');

// Funções auxiliares
async function logEquipmentChange(connection, equipmentId, action, changes, userId) {
  // Filtra mudanças válidas
  const mudancasReais = {};
  
  Object.entries(changes).forEach(([campo, valores]) => {
    if (valores.de !== valores.para) {
      mudancasReais[campo] = {
        de: valores.de === null || valores.de === undefined ? 'Não informado' : valores.de,
        para: valores.para === null || valores.para === undefined ? 'Não informado' : valores.para
      };
    }
  });

  if (Object.keys(mudancasReais).length > 0) {
    await connection.query(
      `INSERT INTO equipment_history 
       (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [equipmentId, action, JSON.stringify(mudancasReais), userId]
    );
  }
}

async function getCurrentEquipmentState(connection, equipmentId) {
  const [results] = await connection.query(
    `SELECT id, categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status
     FROM equipamentos
     WHERE id = ?`,
    [equipmentId]
  );
  if (results.length === 0) throw new Error('Equipamento não encontrado');
  return results[0];
}

// Rotas de equipamentos
app.post('/equipamentos', autenticarToken, termoUpload, async (req, res) => {
  const { categoria, nome, dono, setor, descricao, hostname, status, additionalFields } = req.body;
  const termo = req.file ? req.file.filename : null;
  const userId = req.user.id;

  if (!categoria || !nome || !dono || !setor) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
  }

  const identificador = uuidv4();
  const nomeQRCode = `${categoria}_${identificador}.png`.replace(/\s/g, '_');
  const caminhoQRCode = path.join(__dirname, 'uploads', nomeQRCode);

  let connection;
  try {
    await QRCode.toFile(caminhoQRCode, identificador, { width: 300, margin: 2 });

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO equipamentos 
       (categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoria, nome, dono, setor, descricao, termo, identificador, hostname || null, status || 'disponivel']
    );

    const equipamentoId = result.insertId;
    await logEquipmentChange(db, equipamentoId, 'create', {}, req.user.id);


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
          'INSERT INTO equipamento_campos_adicionais (equipamento_id, nome_campo, valor) VALUES ?',
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
});

app.get('/equipamentos', async (req, res) => {
  const { hostname, status } = req.query;
  let query = 'SELECT * FROM equipamentos WHERE 1=1';
  const values = [];

  if (hostname) {
    query += ' AND hostname LIKE ?';
    values.push(`%${hostname}%`);
  }

  if (status) {
    query += ' AND status = ?';
    values.push(status);
  }

  try {
    const [equipamentos] = await db.query(query, values);

    const equipamentosComCampos = await Promise.all(
      equipamentos.map(async eq => {
        const [campos] = await db.query(
          'SELECT nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
          [eq.id]
        );
        
        eq.additionalFields = {};
        campos.forEach(c => {
          eq.additionalFields[c.nome_campo] = c.valor;
        });
        
        return eq;
      })
    );

    res.json(equipamentosComCampos);
  } catch (err) {
    console.error('Erro ao buscar equipamentos:', err);
    res.status(500).json({ error: 'Erro ao buscar equipamentos' });
  }
});

app.get('/historico', async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        eh.*,
        e.nome as equipment_name,
        u.user as user_name
      FROM equipment_history eh
      LEFT JOIN equipamentos e ON eh.equipment_id = e.id
      LEFT JOIN usuarios u ON eh.user_id = u.id
      ORDER BY eh.timestamp DESC
    `);

    const historicoFormatado = results.map(item => {
      const changes = item.changed_fields ? JSON.parse(item.changed_fields) : {};
      
      // Formata as mudanças para exibição
      const alteracoesFormatadas = Object.entries(changes)
        .map(([campo, valores]) => {
          const de = valores.de === 'Não informado' ? 'N/A' : valores.de;
          const para = valores.para === 'Não informado' ? 'N/A' : valores.para;
          return `• ${campo}: ${de} → ${para}`;
        })
        .join('\n');

      return {
        ...item,
        alteracoesFormatadas
      };
    });

    res.json(historicoFormatado);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

app.get('/equipamentos/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [results] = await db.query(
      `SELECT id, categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status
       FROM equipamentos 
       WHERE id = ?`,
      [id]
    );
    
    if (results.length === 0) {
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    const equipamento = results[0];
    const [campos] = await db.query(
      'SELECT nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
      [id]
    );

    equipamento.additionalFields = {};
    campos.forEach(c => {
      equipamento.additionalFields[c.nome_campo] = c.valor;
    });

    res.json(equipamento);
  } catch (err) {
    console.error('Erro ao buscar equipamento:', err);
    res.status(500).json({ error: 'Erro ao buscar equipamento.' });
  }
});

app.delete('/equipamentos/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verificar existência do equipamento
    const [equipment] = await connection.query(
      'SELECT * FROM equipamentos WHERE id = ?', 
      [id]
    );
    
    if (equipment.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    // 1. Remover campos adicionais
    await connection.query(
      'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
      [id]
    );

    // 2. Remover equipamento (trigger registrará histórico automaticamente)
    await connection.query(
      'DELETE FROM equipamentos WHERE id = ?',
      [id]
    );

    await connection.commit();
    res.json({ message: 'Equipamento excluído com sucesso.' });
  } catch (error) {
    if (connection) await connection.rollback();
    
    console.error('Erro ao excluir equipamento:', error);
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(500).json({
        error: 'Erro de integridade referencial',
        solution: 'Verifique a trigger after_equipment_delete na tabela equipamentos',
        details: error.message
      });
    }

    res.status(500).json({ 
      error: 'Erro ao excluir equipamento',
      details: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
});

app.put('/equipamentos/:id', autenticarToken, upload.single('termo'), async (req, res) => {
  if (!req.body) return res.status(400).json({ error: 'Corpo da requisição está vazio.' });

  const { id } = req.params;
  const userId = req.user.id;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Obter estado atual com tratamento de erro
    const oldState = await getCurrentEquipmentState(connection, id);
    console.log('Estado antigo:', oldState);

    // 2. Preparar novos valores (apenas campos enviados)
    const newState = { ...oldState };
    const camposPermitidos = ['categoria', 'nome', 'dono', 'setor', 'descricao', 'hostname', 'status'];
    
    camposPermitidos.forEach(campo => {
      if (req.body[campo] !== undefined) {
        newState[campo] = req.body[campo];
      }
    });

    // Tratamento especial para o termo
    newState.termo = req.file ? req.file.filename : 
                   (req.body.removerTermo === 'true' ? null : oldState.termo);

    // 3. Identificar mudanças reais (com comparação robusta)
    const changes = {};
const camposParaComparar = ['categoria', 'nome', 'dono', 'setor', 'descricao', 'hostname', 'status', 'termo'];

camposParaComparar.forEach(key => {
  if (req.body[key] !== undefined) { // Só verifica campos enviados
    const oldValue = oldState[key];
    const newValue = key === 'termo' 
      ? (req.file ? req.file.filename : (req.body.removerTermo === 'true' ? null : oldState.termo))
      : req.body[key];
    
    if (!isDeepEqual(oldValue, newValue)) {
      changes[key] = {
        de: formatValue(oldValue),
        para: formatValue(newValue)
      };
    }
  }
});


    // 4. Aplicar atualização no equipamento
    await connection.query(
      `UPDATE equipamentos
       SET categoria = ?, nome = ?, dono = ?, setor = ?, descricao = ?,
           hostname = ?, termo = ?, status = ?
       WHERE id = ?`,
      [
        newState.categoria,
        newState.nome,
        newState.dono,
        newState.setor,
        newState.descricao,
        newState.hostname,
        newState.termo,
        newState.status,
        id
      ]
    );

    // 5. Registrar no histórico APENAS mudanças reais
    if (Object.keys(changes).length > 0) {
      console.log('Mudanças detectadas:', changes);
      await logEquipmentChange(connection, id, 'update', changes, userId);
    }

    // 6. Processar campos adicionais se existirem
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
              'INSERT INTO equipamento_campos_adicionais (equipamento_id, nome_campo, valor) VALUES ?',
              [values]
            );
          }
        }
      } catch (e) {
        console.error('Erro ao processar additionalFields:', e);
        throw new Error('Formato inválido para campos adicionais');
      }
    }

    await connection.commit();
    res.json({ 
      success: true,
      message: 'Equipamento atualizado com sucesso',
      changes: Object.keys(changes).length > 0 ? changes : null
    });

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Erro na atualização:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ 
      success: false,
      error: 'Erro ao atualizar equipamento',
      details: error.message
    });
  } finally {
    if (connection) connection.release();
  }
});

// Funções auxiliares
function isDeepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(value) {
  if (value === null || value === undefined) return 'Não informado';
  if (value === '') return 'Vazio';
  return value;
}

async function logEquipmentChange(connection, equipmentId, action, changes, userId) {
  // Filtra apenas mudanças válidas (onde 'de' != 'para')
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
}

// Rotas de histórico
app.get('/api/equipment/history', autenticarToken, async (req, res) => {
  const { serviceTag, userId, startDate, endDate, action } = req.query;
  let query = `
    SELECT 
      eh.*, 
      e.nome as serviceTag, 
      e.qrCode,
      u.user as user_name
    FROM equipment_history eh
    LEFT JOIN equipamentos e ON eh.equipment_id = e.id
    LEFT JOIN usuarios u ON eh.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (serviceTag) {
    query += ' AND e.nome LIKE ?';
    params.push(`%${serviceTag}%`);
  }

  if (userId) {
    query += ' AND eh.user_id = ?';
    params.push(userId);
  }

  if (action) {
    query += ' AND eh.action = ?';
    params.push(action);
  }

  if (startDate) {
    query += ' AND eh.timestamp >= ?';
    params.push(new Date(startDate).toISOString().slice(0, 19).replace('T', ' '));
  }

  if (endDate) {
    query += ' AND eh.timestamp <= ?';
    params.push(new Date(endDate).toISOString().slice(0, 19).replace('T', ' '));
  }

  query += ' ORDER BY eh.timestamp DESC';

  try {
    const [results] = await db.query(query, params);

    const parsedResults = results.map(item => ({
      ...item,
      changed_fields: item.changed_fields ? JSON.parse(item.changed_fields) : null,
      Equipment: {
        serviceTag: item.serviceTag,
        qrCode: item.qrCode
      },
      user: {
        name: item.user_name
      }
    }));

    res.json(parsedResults);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ error: 'Erro ao buscar histórico de alterações' });
  }
});

// Rotas de categorias
app.get('/categorias', async (req, res) => {
  try {
    const [categorias] = await db.query('SELECT id, nome FROM categorias');

    const categoriasComCampos = await Promise.all(
      categorias.map(async cat => {
        const [campos] = await db.query(
          'SELECT nome_campo, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ?',
          [cat.id]
        );
        
        return {
          id: cat.id,
          nome: cat.nome,
          additionalFields: campos.map(c => ({ 
            name: c.nome_campo, 
            unique: !!c.conteudo_unico 
          }))
        };
      })
    );

    res.json(categoriasComCampos);
  } catch (err) {
    console.error('Erro ao buscar categorias:', err);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

app.post('/categorias', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { nome, additionalFields } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      'INSERT INTO categorias (nome) VALUES (?)',
      [nome]
    );

    const categoriaId = result.insertId;

    if (Array.isArray(additionalFields) && additionalFields.length > 0) {
      const values = additionalFields.map(f => [
        categoriaId, 
        f.name, 
        f.unique ? 1 : 0
      ]);
      
      await connection.query(
        'INSERT INTO categoria_campos_adicionais (categoria_id, nome_campo, conteudo_unico) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.status(201).json({ 
      message: 'Categoria e campos adicionais adicionados com sucesso', 
      id: categoriaId 
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Erro ao inserir categoria:', err);
    res.status(500).json({ error: 'Erro ao inserir categoria' });
  } finally {
    if (connection) connection.release();
  }
});

// Atualizar categoria existente
app.put('/categorias/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, additionalFields } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Atualiza a categoria
    const [updateResult] = await connection.query(
      'UPDATE categorias SET nome = ? WHERE id = ?',
      [nome, id]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Remove campos adicionais existentes
    await connection.query(
      'DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?',
      [id]
    );

    // Adiciona novos campos se existirem
    if (Array.isArray(additionalFields) && additionalFields.length > 0) {
      const values = additionalFields.map(f => [
        id, 
        f.name, 
        f.unique ? 1 : 0
      ]);
      
      await connection.query(
        'INSERT INTO categoria_campos_adicionais (categoria_id, nome_campo, conteudo_unico) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    res.json({ message: 'Categoria atualizada com sucesso' });
  } catch (err) {
    if (connection) await connection.rollback();
    
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
    }
    
    console.error('Erro ao atualizar categoria:', err);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  } finally {
    if (connection) connection.release();
  }
});

// Excluir categoria
app.delete('/categorias/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Verifica se existem equipamentos usando esta categoria
    const [equipamentos] = await connection.query(
      'SELECT COUNT(*) as total FROM equipamentos WHERE categoria = ?',
      [id]
    );

    if (equipamentos[0].total > 0) {
      await connection.rollback();
      return res.status(400).json({ 
        error: 'Não é possível excluir. Existem equipamentos associados a esta categoria.' 
      });
    }

    // Remove campos adicionais primeiro
    await connection.query(
      'DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?',
      [id]
    );

    // Remove a categoria
    const [result] = await connection.query(
      'DELETE FROM categorias WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    await connection.commit();
    res.json({ message: 'Categoria excluída com sucesso' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Erro ao excluir categoria:', err);
    res.status(500).json({ error: 'Erro ao excluir categoria' });
  } finally {
    if (connection) connection.release();
  }
});

// Rotas de status
app.get('/status', async (req, res) => {
  try {
    const [results] = await db.query('SELECT * FROM status_equipamentos ORDER BY nome');
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar status:', err);
    res.status(500).json({ error: 'Erro ao buscar status' });
  }
});

app.post('/status', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: 'Status inválido' });

  try {
    await db.query('INSERT INTO status_equipamentos (nome) VALUES (?)', [nome]);
    res.sendStatus(201);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Status já existe' });
    }
    console.error('Erro ao adicionar status:', err);
    res.status(500).json({ error: 'Erro ao adicionar status' });
  }
});

// Atualizar status existente
app.put('/status/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ error: 'Nome do status é obrigatório' });
  }

  try {
    const [result] = await db.query(
      'UPDATE status_equipamentos SET nome = ? WHERE id = ?',
      [nome, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Status não encontrado' });
    }

    res.json({ message: 'Status atualizado com sucesso' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Já existe um status com este nome' });
    }
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// Excluir status
app.delete('/status/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    // Verifica se existem equipamentos usando este status
    const [equipamentos] = await db.query(
      'SELECT COUNT(*) as total FROM equipamentos WHERE status = ?',
      [id]
    );

    if (equipamentos[0].total > 0) {
      return res.status(400).json({ 
        error: 'Não é possível excluir. Existem equipamentos com este status.' 
      });
    }

    const [result] = await db.query(
      'DELETE FROM status_equipamentos WHERE id = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Status não encontrado' });
    }

    res.json({ message: 'Status excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir status:', err);
    res.status(500).json({ error: 'Erro ao excluir status' });
  }
});

// Rotas de usuários
app.post('/register', async (req, res) => {
  const { email, nome, user, senha } = req.body;

  if (!email || !nome || !user || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    
    const [results] = await connection.query(
      'SELECT * FROM usuarios WHERE user = ? OR email = ?',
      [user, email]
    );
    
    if (results.length > 0) {
      return res.status(409).json({ error: 'Usuário ou email já existe.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 12);

    await connection.query(
      `INSERT INTO usuarios (email, nome, user, senha)
       VALUES (?, ?, ?, ?)`,
      [email, nome, user, hashedPassword]
    );

    res.status(201).json({ message: 'Usuário registrado com sucesso!' });
  } catch (err) {
    console.error('Erro ao registrar usuário:', err);
    res.status(500).json({ error: 'Erro ao registrar usuário.' });
  } finally {
    if (connection) connection.release();
  }
});

app.post('/login', express.json(), async (req, res) => {
  const { user, senha } = req.body;
  if (!user || !senha) return res.status(400).json({ error: 'User e senha são obrigatórios.' });

  try {
    const [results] = await db.query(
      'SELECT * FROM usuarios WHERE user = ?',
      [user]
    );
    
    if (results.length === 0) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    const usuario = results[0];
    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
    
    if (!usuario.autorizado) {
      return res.status(403).json({ error: 'Usuário não autorizado.' });
    }

    const token = jwt.sign({
      id: usuario.id,
      user: usuario.user,
      admin: usuario.admin,
      inventariante: usuario.inventariante
    }, SECRET, { expiresIn: '1h' });

    res.json({ message: 'Login bem-sucedido', token });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ error: 'Erro no servidor.' });
  }
});

// Rotas administrativas
app.get('/admin/users', autenticarToken, verificarAdmin, async (req, res) => {
  try {
    const [results] = await db.query(
      'SELECT id, nome, user, email, admin, autorizado, inventariante FROM usuarios'
    );
    res.json(results);
  } catch (err) {
    console.error('Erro ao buscar usuários:', err);
    res.status(500).json({ erro: 'Erro no banco' });
  }
});

app.post('/admin/toggle-admin/:id', autenticarToken, verificarAdmin, async (req, res) => {
  const id = req.params.id;
  
  try {
    await db.query(
      'UPDATE usuarios SET admin = NOT admin WHERE id = ?',
      [id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao atualizar admin:', err);
    res.status(500).json({ erro: 'Erro ao atualizar admin' });
  }
});

app.post('/admin/toggle-inventariante/:id', autenticarToken, verificarAdmin, async (req, res) => {
  const id = req.params.id;
  
  try {
    await db.query(
      'UPDATE usuarios SET inventariante = NOT inventariante WHERE id = ?',
      [id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao atualizar inventariante:', err);
    res.status(500).json({ erro: 'Erro ao atualizar inventariante' });
  }
});

app.post('/admin/toggle-autorizado/:id', autenticarToken, verificarAdmin, async (req, res) => {
  const id = req.params.id;
  
  try {
    await db.query(
      'UPDATE usuarios SET autorizado = NOT autorizado WHERE id = ?',
      [id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao atualizar autorização:', err);
    res.status(500).json({ erro: 'Erro ao atualizar autorização' });
  }
});

app.post('/admin/atualizar-permissao/:id', autenticarToken, async (req, res) => {
  const { id } = req.params;
  const { campo, valor } = req.body;

  if (!['admin', 'inventariante', 'autorizado'].includes(campo)) {
    return res.status(400).json({ erro: 'Campo inválido.' });
  }

  try {
    await db.query(
      `UPDATE usuarios SET ${campo} = ? WHERE id = ?`,
      [valor ? 1 : 0, id]
    );
    res.json({ sucesso: true });
  } catch (err) {
    console.error('Erro ao atualizar permissão:', err);
    res.status(500).json({ erro: 'Erro ao atualizar permissão.' });
  }
});

app.post('/admin/alterar-senha/:id', autenticarToken, verificarAdmin, async (req, res) => {
  const { id } = req.params;
  const { novaSenha } = req.body;

  if (!novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: 'Senha inválida. Mínimo 6 caracteres.' });
  }

  try {
    const hash = await bcrypt.hash(novaSenha, 12);
    await db.query(
      'UPDATE usuarios SET senha = ? WHERE id = ?',
      [hash, id]
    );
    res.json({ message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('Erro ao atualizar senha:', err);
    res.status(500).json({ erro: 'Erro ao atualizar senha.' });
  }
});



app.post('/admin/update-permission', autenticarToken, verificarAdmin, async (req, res) => {
  try {
    const { userId, field, value } = req.body;
    
    // Validação dos parâmetros
    if (!userId || !['admin', 'inventariante', 'autorizado'].includes(field) || typeof value !== 'boolean') {
      return res.status(400).json({ 
        success: false,
        message: 'Parâmetros inválidos',
        details: {
          received: { userId, field, value },
          expected: {
            userId: 'number',
            field: "'admin' | 'inventariante' | 'autorizado'",
            value: 'boolean'
          }
        }
      });
    }

    // Atualização no banco de dados
    const [result] = await db.query(
      `UPDATE usuarios SET ${field} = ? WHERE id = ?`,
      [value ? 1 : 0, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'Usuário não encontrado' 
      });
    }

    res.json({ 
      success: true,
      message: 'Permissão atualizada com sucesso',
      data: {
        userId,
        field,
        newValue: value
      }
    });

  } catch (error) {
    console.error('Erro ao atualizar permissão:', {
      error: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Erro interno ao atualizar permissão',
      error: error.message
    });
  }
});

app.delete('/admin/excluir/:id', autenticarToken, verificarAdmin, async (req, res) => {
  const id = req.params.id;
  
  try {
    await db.query(
      'DELETE FROM usuarios WHERE id = ?',
      [id]
    );
    res.sendStatus(200);
  } catch (err) {
    console.error('Erro ao deletar usuário:', err);
    res.status(500).json({ erro: 'Erro ao deletar usuário' });
  }
});



// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://10.218.172.40:${PORT}`);
});