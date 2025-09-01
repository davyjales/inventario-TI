const express = require('express');
const router = express.Router();
const { autenticarToken, verificarAdmin } = require('../middlewares/auth');
const db = require('../db');

// POST /admin/update-permission - Atualizar permissão de usuário
router.post('/update-permission', autenticarToken, verificarAdmin, async (req, res) => {
  try {
    const { userId, field, value } = req.body;
    
    if (!userId || !field || value === undefined) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const validFields = ['admin', 'inventariante', 'autorizado'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ error: 'Campo inválido' });
    }

    const query = `UPDATE usuarios SET ${field} = ? WHERE id = ?`;
    const [result] = await db.execute(query, [value, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Permissão atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar permissão:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /admin/change-password - Alterar senha de usuário
router.post('/change-password', autenticarToken, verificarAdmin, async (req, res) => {
  try {
    const { userId, newPassword } = req.body;
    
    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // Hash da senha (simplificado para exemplo)
    const hashedPassword = newPassword; // Em produção, use bcrypt
    
    const [result] = await db.execute(
      'UPDATE usuarios SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json({ success: true, message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
