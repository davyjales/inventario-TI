const express = require('express');
const router = express.Router();
const categoriasService = require('../services/categoriasService');

// Existing routes...

// New endpoint to fetch options for the "lista" type
router.get('/opcoes', async (req, res) => {
  try {
    const options = await categoriasService.getListaOptions(); // Assuming this function exists
    res.json(options);
  } catch (error) {
    console.error("Error fetching options:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Existing routes...

module.exports = router;
