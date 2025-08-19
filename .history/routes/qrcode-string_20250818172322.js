const express = require('express');
const router = express.Router();

// Route to generate QR code string for Zebra printer
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    // Return QR code data string instead of image
    res.json({ 
      qrCodeString: code,
      zebraFormat: `^XA^FO50,50^BQN,2,10^FDLA,${code}^FS^XZ`
    });
  } catch (err) {
    console.error('Erro ao gerar QR code string:', err);
    res.status(500).json({ error: 'Erro ao gerar QR code string' });
  }
});

module.exports = router;
