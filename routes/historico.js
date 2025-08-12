const express = require('express');
const router = express.Router();
const historicoService = require('../services/historicoService');

router.get('/', historicoService.listarHistorico);

module.exports = router;
