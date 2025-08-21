const express = require('express');
const router = express.Router();

// Mock data for cargos (positions/roles)
const cargos = [
  { id: 1, nome: 'Analista de TI' },
  { id: 2, nome: 'Gerente de Projetos' },
  { id: 3, nome: 'Coordenador' },
  { id: 4, nome: 'Assistente' },
  { id: 5, nome: 'Estagiário' },
  { id: 6, nome: 'Técnico' },
  { id: 7, nome: 'Supervisor' },
  { id: 8, nome: 'Diretor' }
];

// GET /api/cargos
router.get('/', (req, res) => {
  res.json(cargos);
});

module.exports = router;
