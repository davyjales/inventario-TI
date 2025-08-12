const db = require('../config/db');

module.exports = {
  // Listar todas as categorias com seus campos adicionais
  async listarCategorias(req, res) {
    try {
      const [categorias] = await db.query('SELECT * FROM categorias');

      const categoriasComCampos = await Promise.all(
        categorias.map(async cat => {
          const [campos] = await db.query(
            'SELECT id, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ? ORDER BY id ASC',
            [cat.id]
          );
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
      categoria.campos_adicionais = campos;
      res.json(categoria);
    } catch (err) {
      console.error('Erro ao buscar categoria:', err);
      res.status(500).json({ error: 'Erro ao buscar categoria' });
    }
  },

  // Criar nova categoria com campos
  async criarCategoria(req, res) {
    const { nome, campos, recebe_termo } = req.body; // campos = [{ nome_campo, tipo, obrigatorio, conteudo_unico }, ...]

    if (!nome) {
      return res.status(400).json({ error: 'Nome da categoria é obrigatório' });
    }

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO categorias (nome, recebe_termo) VALUES (?, ?)',
        [nome, !!recebe_termo]
      );

      const categoriaId = result.insertId;

      if (Array.isArray(campos) && campos.length > 0) {
        const values = campos.map(c => [categoriaId, c.nome_exibicao, c.tipo, !!c.obrigatorio, !!c.conteudo_unico]);
        await connection.query(
          'INSERT INTO categoria_campos_adicionais (categoria_id, nome_exibicao, tipo, obrigatorio, conteudo_unico) VALUES ?',
          [values]
        );
      }

      await connection.commit();
      res.status(201).json({ message: 'Categoria criada com sucesso', id: categoriaId });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Erro ao criar categoria:', err);
      res.status(500).json({ error: 'Erro ao criar categoria' });
    } finally {
      if (connection) connection.release();
    }
  },

  // Atualizar categoria e seus campos
  async atualizarCategoria(req, res) {
    const { id } = req.params;
    const { nome, campos, recebe_termo } = req.body;

    let connection;
    try {
      connection = await db.getConnection();
      await connection.beginTransaction();

      if (nome !== undefined) {
        await connection.query('UPDATE categorias SET nome = ?, recebe_termo = ? WHERE id = ?', [nome, !!recebe_termo, id]);
      }

      if (Array.isArray(campos)) {
        await connection.query('DELETE FROM categoria_campos_adicionais WHERE categoria_id = ?', [id]);

        if (campos.length > 0) {
          const values = campos.map(c => [id, c.nome_exibicao, c.tipo, !!c.obrigatorio, !!c.conteudo_unico]);
          await connection.query(
            'INSERT INTO categoria_campos_adicionais (categoria_id, nome_exibicao, tipo, obrigatorio, conteudo_unico) VALUES ?',
            [values]
          );
        }
      }

      await connection.commit();
      res.json({ message: 'Categoria atualizada com sucesso' });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('Erro ao atualizar categoria:', err);
      res.status(500).json({ error: 'Erro ao atualizar categoria' });
    } finally {
      if (connection) connection.release();
    }
  },

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
        'SELECT id, nome_exibicao, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais WHERE categoria_id = ? ORDER BY id ASC',
        [id]
      );
      res.json(campos);
    } catch (err) {
      console.error('Erro ao buscar campos da categoria:', err);
      res.status(500).json({ error: 'Erro ao buscar campos da categoria' });
    }
  }
};
