// routes/camposAdicionais.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");

// GET /api/campos-adicionais
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
         c.id AS categoria_id,
         c.nome AS categoria_nome,
         ca.id AS campo_id,
         ca.nome_exibicao,
         ca.tipo,
         ca.obrigatorio,
         ca.conteudo_unico
       FROM categorias c
       LEFT JOIN categoria_campos_adicionais ca ON ca.categoria_id = c.id
       ORDER BY c.id, ca.id`
    );

    // Mapeia para o formato que o frontend espera
    const categorias = {};

    rows.forEach((row) => {
      if (!categorias[row.categoria_id]) {
        categorias[row.categoria_id] = {
          id: row.categoria_id,
          nome: row.categoria_nome,
          campos: [],
        };
      }

      if (row.campo_id) {
        categorias[row.categoria_id].campos.push({
          id: row.campo_id,
          nome_exibicao: row.nome_exibicao,
          tipo: row.tipo,
          obrigatorio: row.obrigatorio,
          conteudo_unico: row.conteudo_unico,
        });
      }
    });

    res.json(Object.values(categorias));
  } catch (err) {
    console.error("Erro ao buscar campos adicionais:", err);
    res.status(500).json({ error: "Erro ao buscar campos adicionais" });
  }
});

module.exports = router;
