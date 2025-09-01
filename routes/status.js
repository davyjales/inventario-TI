const express = require('express');
const router = express.Router();
const { autenticarToken, verificarInventarianteOuAdmin } = require('../middlewares/auth');
const statusService = require('../services/statusService');

router.get('/', statusService.listarStatus);
router.post('/', autenticarToken, verificarInventarianteOuAdmin, statusService.criarStatus);
router.put('/:id', autenticarToken, verificarInventarianteOuAdmin, statusService.atualizarStatus);
router.delete('/:id', autenticarToken, verificarInventarianteOuAdmin, statusService.excluirStatus);

module.exports = router;
