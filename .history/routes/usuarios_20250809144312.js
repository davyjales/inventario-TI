const express = require('express');
const router = express.Router();
const { autenticarToken, verificarAdmin } = require('../middlewares/auth');
const usuariosService = require('../services/usuariosService');

router.post('/register', usuariosService.registrarUsuario);
router.post('/login', usuariosService.loginUsuario);
router.get('/admin/users', autenticarToken, verificarAdmin, usuariosService.listarUsuarios);
router.post('/admin/toggle-admin/:id', autenticarToken, verificarAdmin, usuariosService.toggleAdmin);
router.post('/admin/toggle-inventariante/:id', autenticarToken, verificarAdmin, usuariosService.toggleInventariante);
router.post('/admin/toggle-autorizado/:id', autenticarToken, verificarAdmin, usuariosService.toggleAutorizado);
router.post('/admin/alterar-senha/:id', autenticarToken, verificarAdmin, usuariosService.alterarSenha);
router.delete('/admin/excluir/:id', autenticarToken, verificarAdmin, usuariosService.excluirUsuario);

module.exports = router;
