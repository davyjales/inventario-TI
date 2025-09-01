const express = require('express');
const router = express.Router();
const { autenticarToken, verificarInventarianteOuAdmin } = require('../middlewares/auth');
const categoriasService = require('../services/categoriasService');

router.get('/', categoriasService.listarCategorias);
router.post('/', autenticarToken, verificarInventarianteOuAdmin, categoriasService.criarCategoria);
router.put('/:id', autenticarToken, verificarInventarianteOuAdmin, categoriasService.atualizarCategoria);
router.delete('/:id', autenticarToken, verificarInventarianteOuAdmin, categoriasService.excluirCategoria);

module.exports = router;
