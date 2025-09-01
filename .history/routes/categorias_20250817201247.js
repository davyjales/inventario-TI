const express = require('express');
const router = express.Router();
const categoriasService = require('../services/categoriasService');

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

module.exports = router;
