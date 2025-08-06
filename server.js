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
  await connection.query(
    `INSERT INTO equipment_history 
     (equipment_id, action, changed_fields, user_id)
     VALUES (?, ?, ?, ?)`,
    [equipmentId, action, JSON.stringify(changes), userId || null]
  );
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
    // Gerar QR Code
    await QRCode.toFile(caminhoQRCode, identificador, { width: 300, margin: 2 });

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Inserir equipamento
    const [result] = await connection.query(
      `INSERT INTO equipamentos 
       (categoria, nome, dono, setor, descricao, termo, qrCode, hostname, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoria, nome, dono, setor, descricao, termo, identificador, hostname || null, status || 'disponivel']
    );

    const equipamentoId = result.insertId;

    // Registrar histórico
    await logEquipmentChange(
      connection,
      equipamentoId,
      'create',
      { 
        initial_data: { categoria, nome, dono, setor, descricao, hostname, status },
        additionalFields: additionalFields ? JSON.parse(additionalFields) : []
      },
      userId
    );

    // Inserir campos adicionais se existirem
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
  const userId = req.user.id;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Obter dados do equipamento
    const [equipmentResults] = await connection.query(
      'SELECT * FROM equipamentos WHERE id = ?', 
      [id]
    );
    
    if (equipmentResults.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Equipamento não encontrado' });
    }

    const equipment = equipmentResults[0];

    // Obter campos adicionais
    const [additionalFields] = await connection.query(
      'SELECT nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?', 
      [id]
    );

    // Registrar no histórico
    await connection.query(
      `INSERT INTO equipment_history 
       (equipment_id, action, changed_fields, user_id)
       VALUES (?, ?, ?, ?)`,
      [
        id,
        'delete',
        JSON.stringify({
          deleted_data: {
            ...equipment,
            additionalFields: additionalFields.reduce((acc, field) => ({
              ...acc,
              [field.nome_campo]: field.valor
            }), {})
          }
        }),
        userId
      ]
    );

    // Remover campos adicionais
    await connection.query(
      'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
      [id]
    );

    // Remover o equipamento
    await connection.query(
      'DELETE FROM equipamentos WHERE id = ?',
      [id]
    );

    await connection.commit();
    res.json({ message: 'Equipamento excluído com sucesso.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Erro ao excluir equipamento:', error);
    
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(500).json({
        error: 'Erro de integridade referencial',
        solution: 'Verifique a constraint ON DELETE CASCADE na tabela equipment_history',
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
  const { categoria, nome, dono, setor, descricao, hostname, removerTermo, status, additionalFields } = req.body;
  const novoTermo = req.file ? req.file.filename : null;
  const userId = req.user.id;
  let connection;

  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Obter estado anterior
    const oldState = await getCurrentEquipmentState(connection, id);
    const [oldAdditionalFields] = await connection.query(
      'SELECT nome_campo, valor FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
      [id]
    );

    // Verificar termo antigo
    const [termoResults] = await connection.query(
      'SELECT termo FROM equipamentos WHERE id = ?',
      [id]
    );

    if (termoResults.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Equipamento não encontrado.' });
    }

    const termoAntigo = termoResults[0].termo;
    const deveRemoverTermo = removerTermo === 'true';
    let novoValorTermo = termoAntigo;

    if (deveRemoverTermo || novoTermo) {
      if (termoAntigo) {
        const caminhoAntigo = path.join(__dirname, 'uploads', termoAntigo);
        fs.unlink(caminhoAntigo, (fsErr) => {
          if (fsErr && fsErr.code !== 'ENOENT') {
            console.warn('Erro ao remover termo antigo:', fsErr);
          }
        });
      }
      novoValorTermo = novoTermo || null;
    }

    // Atualizar equipamento
    await connection.query(
      `UPDATE equipamentos
       SET categoria = ?, nome = ?, dono = ?, setor = ?, descricao = ?, 
           hostname = ?, termo = ?, status = ?
       WHERE id = ?`,
      [
        categoria, nome, dono, setor, descricao, 
        hostname || null, novoValorTermo, status || 'disponivel', id
      ]
    );

    // Registrar alterações no histórico
    const newState = {
      categoria, nome, dono, setor, descricao, 
      hostname: hostname || null, 
      status: status || 'disponivel',
      termo: novoValorTermo
    };

    const changes = {};
    for (const key in newState) {
      if (oldState[key] !== newState[key]) {
        changes[key] = [oldState[key], newState[key]];
      }
    }

    // Verificar alterações nos campos adicionais
    let newAdditionalFields = [];
    try {
      newAdditionalFields = additionalFields ? JSON.parse(additionalFields) : [];
    } catch {}

    const additionalChanges = {};
    oldAdditionalFields.forEach(oldField => {
      const newField = newAdditionalFields.find(f => f.name === oldField.nome_campo);
      if (!newField || newField.value !== oldField.valor) {
        additionalChanges[oldField.nome_campo] = [oldField.valor, newField?.value || null];
      }
    });

    if (Object.keys(additionalChanges).length > 0) {
      changes.additionalFields = additionalChanges;
    }

    if (Object.keys(changes).length > 0) {
      await logEquipmentChange(connection, id, 'update', changes, userId);
    }

    // Atualizar campos adicionais
    if (additionalFields) {
      let campos;
      try {
        campos = JSON.parse(additionalFields);
      } catch {
        campos = [];
      }

      // Remover campos existentes
      await connection.query(
        'DELETE FROM equipamento_campos_adicionais WHERE equipamento_id = ?',
        [id]
      );

      // Inserir novos campos
      if (campos.length > 0) {
        const values = campos.map(f => [id, f.name, f.value]);
        await connection.query(
          'INSERT INTO equipamento_campos_adicionais (equipamento_id, nome_campo, valor) VALUES ?',
          [values]
        );
      }
    }

    await connection.commit();
    res.json({ message: 'Equipamento atualizado com sucesso.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error('Erro ao atualizar equipamento:', error);
    res.status(500).json({ error: 'Erro ao atualizar equipamento.' });
  } finally {
    if (connection) connection.release();
  }
});

// Rotas de histórico
app.get('/api/equipment/history', autenticarToken, async (req, res) => {
  const { serviceTag, userId, startDate, endDate, action } = req.query;
  let query = `
    SELECT eh.*, e.nome as serviceTag, e.qrCode
    FROM equipment_history eh
    LEFT JOIN equipamentos e ON eh.equipment_id = e.id
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
    if (connection) {
      await connection.rollback();
    }
    console.error('Erro ao inserir categoria:', err);
    res.status(500).json({ error: 'Erro ao inserir categoria' });
  } finally {
    if (connection) connection.release();
  }
});

// PUT /categorias/:id - Atualizar categoria
app.put('/categorias/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, additionalFields } = req.body;
  if (!nome) return res.status(400).json({ error: 'Nome da categoria é obrigatório' });

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [result] = await connection.query(
      'UPDATE categorias SET nome = ? WHERE id = ?',
      [nome, id]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    // Remove campos adicionais antigos
    await connection.query(
      'DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?',
      [id]
    );

    // Insere novos campos adicionais
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
    if (connection) {
      await connection.rollback();
    }
    console.error('Erro ao atualizar categoria:', err);
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  } finally {
    if (connection) connection.release();
  }
});

// DELETE /categorias/:id - Excluir categoria
app.delete('/categorias/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM categorias WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    res.json({ message: 'Categoria excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir categoria:', err);
    res.status(500).json({ error: 'Erro ao excluir categoria' });
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

// PUT /status/:id - Atualizar status
app.put('/status/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ error: 'Status inválido' });

  try {
    const [result] = await db.query('UPDATE status_equipamentos SET nome = ? WHERE id = ?', [nome, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Status não encontrado' });
    }
    res.json({ message: 'Status atualizado com sucesso' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Status já existe' });
    }
    console.error('Erro ao atualizar status:', err);
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
});

// DELETE /status/:id - Excluir status
app.delete('/status/:id', autenticarToken, verificarInventarianteOuAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query('DELETE FROM status_equipamentos WHERE id = ?', [id]);
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
    
    // Verificar se usuário/email já existe
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

const ExcelJS = require('exceljs');

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

// GET /equipamentos/export/excel - Exportar dados para Excel com filtros
app.get('/equipamentos/export/excel', autenticarToken, async (req, res) => {
  try {
    const { categoria, nome, dono, setor, hostname, status } = req.query;
    
    let query = 'SELECT * FROM equipamentos WHERE 1=1';
    const values = [];

    // Aplicar filtros dinamicamente
    if (categoria && categoria.trim()) {
      query += ' AND categoria LIKE ?';
      values.push(`%${categoria.trim()}%`);
    }
    
    if (nome && nome.trim()) {
      query += ' AND nome LIKE ?';
      values.push(`%${nome.trim()}%`);
    }
    
    if (dono && dono.trim()) {
      query += ' AND dono LIKE ?';
      values.push(`%${dono.trim()}%`);
    }
    
    if (setor && setor.trim()) {
      query += ' AND setor LIKE ?';
      values.push(`%${setor.trim()}%`);
    }
    
    if (hostname && hostname.trim()) {
      query += ' AND hostname LIKE ?';
      values.push(`%${hostname.trim()}%`);
    }
    
    if (status && status.trim()) {
      query += ' AND status LIKE ?';
      values.push(`%${status.trim()}%`);
    }

    const [equipamentos] = await db.query(query, values);

    // Criar workbook e worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Equipamentos');

    // Definir colunas
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Categoria', key: 'categoria', width: 20 },
      { header: 'Nome', key: 'nome', width: 30 },
      { header: 'Dono', key: 'dono', width: 20 },
      { header: 'Setor', key: 'setor', width: 20 },
      { header: 'Descrição', key: 'descricao', width: 40 },
      { header: 'Hostname', key: 'hostname', width: 20 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    // Adicionar linhas
    equipamentos.forEach(eq => {
      worksheet.addRow({
        id: eq.id,
        categoria: eq.categoria,
        nome: eq.nome,
        dono: eq.dono,
        setor: eq.setor,
        descricao: eq.descricao,
        hostname: eq.hostname,
        status: eq.status
      });
    });

    // Configurar resposta para download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=equipamentos_filtrados.xlsx');

    // Enviar arquivo Excel
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Erro ao exportar para Excel:', err);
    res.status(500).json({ error: 'Erro ao exportar para Excel' });
  }
});
