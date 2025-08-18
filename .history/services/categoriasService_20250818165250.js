const db = require('../config/db');

module.exports = {
  // Function to get options for the "lista" type
  async getListaOptions(campoId) {
    const query = 'SELECT id, value, label FROM lista_opcoes WHERE campo_id = ?';
    const [rows] = await db.query(query, [campoId]);
    return rows;
  },

  async listarCategorias(req, res) {
    try {
      const [categorias] = await db.query('SELECT * FROM categorias');

      const categoriasComCampos = await Promise.all(
        categorias.map(async cat => {
          const [campos] = await db.query(
            'SELECT id, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ? ORDER BY id ASC',
            [cat.id]
          );

          // Para cada campo, se for "lista", buscar opções
          for (let campo of campos) {
            if (campo.tipo === 'lista') {
              campo.opcoes = await module.exports.getListaOptions(campo.id);
            } else {
              campo.opcoes = [];
            }
          }

          return { ...cat, campos };
        })
      );

      res.json(categoriasComCampos);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
  },

  // Obter categoria por id com campos adicionais
  async obterCategoriaPorId(req, res) {
    const { id } = req.params;
    try {
      const [categorias] = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);
      if (categorias.length === 0) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }
      const categoria = categorias[0];

      const [campos] = await db.query(
        'SELECT id, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ? ORDER BY id ASC',
        [id]
      );

      // Para cada campo, se for "lista", buscar opções
      for (let campo of campos) {
        if (campo.tipo === 'lista') {
          campo.opcoes = await module.exports.getListaOptions(campo.id);
        } else {
          campo.opcoes = [];
        }
      }

      categoria.campos_adicionais = campos;
      res.json(categoria);
    } catch (err) {
      console.error('Erro ao buscar categoria:', err);
      res.status(500).json({ error: 'Erro ao buscar categoria' });
    }
  },


  // Criar nova categoria com campos
  async criarCategoria(req, res) {
    const { nome, campos, recebe_termo } = req.body;
    console.log("Payload received for creating category:", req.body);

    if (!nome) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }

    let connection;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        connection = await db.getConnection();
        
        // Set transaction isolation level to reduce locks
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();

        const [result] = await connection.query(
          'INSERT INTO categorias (nome, recebe_termo) VALUES (?, ?)',
          [nome, !!recebe_termo]
        );

        const categoriaId = result.insertId;

        if (Array.isArray(campos) && campos.length > 0) {
          // Batch insert for better performance
          const camposValues = campos.map(campo => [
            categoriaId, 
            campo.nome_exibicao, 
            campo.tipo, 
            !!campo.obrigatorio, 
            !!campo.conteudo_unico
          ]);
          
          const [camposResult] = await connection.query(
            'INSERT INTO categoria_campos_adicionais (categoria_id, nome_exibicao, tipo, obrigatorio, conteudo_unico) VALUES ?',
            [camposValues]
          );

          // Handle lista options efficiently
          let campoIdBase = camposResult.insertId;
          for (let i = 0; i < campos.length; i++) {
            const campo = campos[i];
            if (campo.tipo === 'lista' && campo.opcoes && campo.opcoes.length > 0) {
              const optionsValues = campo.opcoes.map(opt => [campoIdBase + i, opt, opt]);
              await connection.query(
                'INSERT INTO lista_opcoes (campo_id, value, label) VALUES ?',
                [optionsValues]
              );
            }
          }
        }

        await connection.commit();
        res.status(201).json({ message: 'Categoria criada com sucesso', id: categoriaId });
        return;

      } catch (err) {
        if (connection) {
          await connection.rollback();
          connection.release();
        }

        if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`Retrying transaction due to lock timeout (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount)); // Exponential backoff
          continue;
        }

        console.error('Erro ao criar categoria:', err);
        res.status(500).json({ 
          error: 'Erro ao criar categoria', 
          details: err.code === 'ER_LOCK_WAIT_TIMEOUT' ? 'Database timeout - please try again' : 'Internal server error'
        });
        return;
      }
    }
  },

  
  // Atualizar categoria e seus campos
  async atualizarCategoria(req, res) {
    const { id } = req.params;
    const { nome, campos, recebe_termo } = req.body;
    console.log("Payload received for updating category:", req.body);

    let connection;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        connection = await db.getConnection();
        
        // Set transaction isolation level to reduce locks
        await connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
        await connection.beginTransaction();

        // Atualiza dados básicos da categoria
        if (nome !== undefined) {
          await connection.query(
            'UPDATE categorias SET nome = ?, recebe_termo = ? WHERE id = ?',
            [nome, !!recebe_termo, id]
          );
        }

        if (Array.isArray(campos)) {
          // Apaga os campos e opções antigas
          await connection.query(
            'DELETE FROM lista_opcoes WHERE campo_id IN (SELECT id FROM categoria_campos_adicionais WHERE categoria_id = ?)',
            [id]
          );
          await connection.query(
            'DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?',
            [id]
          );

          if (campos.length > 0) {
            // Batch insert for better performance
            const values = campos.map(c => [id, c.nome_exibicao, c.tipo, !!c.obrigatorio, !!c.conteudo_unico]);
            const [insertResult] = await connection.query(
              'INSERT INTO categoria_campos_adicionais (categoria_id, nome_exibicao, tipo, obrigatorio, conteudo_unico) VALUES ?',
              [values]
            );

            // Handle lista options efficiently
            let campoIdBase = insertResult.insertId;
            for (let i = 0; i < campos.length; i++) {
              const campo = campos[i];
              if (campo.tipo === 'lista' && campo.opcoes && campo.opcoes.length > 0) {
                const optionsValues = campo.opcoes.map(opt => [campoIdBase + i, opt, opt]);
                await connection.query(
                  'INSERT INTO lista_opcoes (campo_id, value, label) VALUES ?',
                  [optionsValues]
                );
              }
            }
          }
        }

        await connection.commit();
        res.json({ message: 'Categoria atualizada com sucesso' });
        return;

      } catch (err) {
        if (connection) {
          await connection.rollback();
          connection.release();
        }

        if (err.code === 'ER_LOCK_WAIT_TIMEOUT' && retryCount < maxRetries - 1) {
          retryCount++;
          console.log(`Retrying transaction due to lock timeout (attempt ${retryCount + 1})`);
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount)); // Exponential backoff
          continue;
        }

        console.error('Erro ao atualizar categoria:', err);
        res.status(500).json({ 
          error: 'Erro ao atualizar categoria', 
          details: err.code === 'ER_LOCK_WAIT_TIMEOUT' ? 'Database timeout - please try again' : 'Internal server error'
        });
        return;
      }
    }
  }
  ,

  // Excluir categoria
  async excluirCategoria(req, res) {
    const { id } = req.params;

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      await connection.query('DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?', [id]);
      await connection.query('DELETE FROM categorias WHERE id = ?', [id]);

      await connection.commit();
      res.json({ message: 'Categoria excluída com sucesso' });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Erro ao excluir categoria:', err);
      res.status(500).json({ error: 'Erro ao excluir categoria' });
    } finally {
      if (connection) connection.release();
    }
  },

  
  // Listar campos adicionais de uma categoria
  async listarCamposPorCategoria(req, res) {
    const { id } = req.params;
    try {
      const [campos] = await db.query(
        'SELECT id, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ? ORDER BY id ASC',
        [id]
      );

      // para cada campo, incluir opções se for lista
      for (let campo of campos) {
        if (campo.tipo === 'lista') {
          campo.opcoes = await module.exports.getListaOptions(campo.id);
        } else {
          campo.opcoes = [];
        }
      }

      res.json(campos);
    } catch (err) {
      console.error('Erro ao buscar campos da categoria:', err);
      res.status(500).json({ error: 'Erro ao buscar campos da categoria' });
    }
  }
}
