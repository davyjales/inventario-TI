const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

  
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rotas
app.use('/api/equipamentos', require('./routes/equipamentos'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/status', require('./routes/status'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/historico', require('./routes/historico'));

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
