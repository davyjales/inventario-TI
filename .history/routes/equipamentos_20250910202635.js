const express = require('express');
const router = express.Router();
const upload = require('../config/multer');
const { autenticarToken } = require('../middlewares/auth');
const equipamentosService = require('../services/equipamentosService');

router.post('/', autenticarToken, upload.single('termo'), equipamentosService.criarEquipamento);
router.get('/', equipamentosService.listarEquipamentos);
router.get('/:id', equipamentosService.buscarEquipamentoPorId);
router.put('/:id', autenticarToken, upload.single('termo'), equipamentosService.atualizarEquipamento);
router.delete('/:id', autenticarToken, equipamentosService.excluirEquipamento);
router.post('/log-consulta', autenticarToken, equipamentosService.logConsulta);

module.exports = router;
