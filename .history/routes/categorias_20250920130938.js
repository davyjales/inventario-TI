const express = require('express');
const router = express.Router();
const categoriasService = require('../services/categoriasService');
const db = require('../config/db');

// Listar todas as categorias
router.get('/', categoriasService.listarCategorias);

// Obter categoria por ID
router.get('/:id', categoriasService.obterCategoriaPorId);

// Criar nova categoria
router.post('/', categoriasService.criarCategoria);

// Atualizar categoria
router.put('/:id', categoriasService.atualizarCategoria);

// Excluir categoria
router.delete('/:id', categoriasService.excluirCategoria);

// Listar campos de uma categoria
router.get('/:id/campos', categoriasService.listarCamposPorCategoria);

// New endpoint to fetch options for the "lista" type
router.get('/opcoes', async (req, res) => {
  try {
    const options = await categoriasService.getListaOptions();
    res.json(options);
  } catch (error) {
    console.error("Error fetching options:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint for fetching all additional fields from all categories (used by Excel export)
router.get('/campos-adicionais', categoriasService.listarCategorias);

// New endpoint to fetch all additional fields with their display names
router.get('/campos-adicionais/all', async (req, res) => {
  try {
    const [campos] = await db.query(
      'SELECT id, nome_exibicao, tipo, obrigatorio, conteudo_unico FROM categoria_campos_adicionais ORDER BY id ASC'
    );
    console.log('Campos adicionais encontrados:', campos);
    res.json(campos);
  } catch (error) {
    console.error("Error fetching additional fields:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

module.exports = router;
