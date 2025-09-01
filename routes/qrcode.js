const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');

// Route to generate and serve QR code image
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const qrDataUrl = await QRCode.toDataURL(code, { errorCorrectionLevel: 'H' });
    const img = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': img.length
    });
    res.end(img);
  } catch (err) {
    console.error('Erro ao gerar QR code:', err);
    res.status(500).json({ error: 'Erro ao gerar QR code' });
  }
});

module.exports = router;
