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
    // First, let's check if the table exists
    const [tables] = await db.query("SHOW TABLES LIKE 'categoria_campos_adicionais'");
    console.log('Tables found:', tables);

    if (tables.length === 0) {
      return res.status(404).json({ message: "Table categoria_campos_adicionais not found" });
    }

    // Check table structure
    const [columns] = await db.query("DESCRIBE categoria_campos_adicionais");
    console.log('Table structure:', columns);

    const [campos] = await db.query(

module.exports = router;
