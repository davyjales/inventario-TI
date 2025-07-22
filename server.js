const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use('/login', express.static(path.join(__dirname, 'login')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json()); // substitui bodyParser.json()
app.use(express.urlencoded({ extended: true })); // para dados de formulários (sem arquivos)
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


const authRoutes = require('./auth');
app.get('/register', (req, res) => {
  res.redirect('/login/register.html');
});
app.use('/', authRoutes);



// Configuração do multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const nomeUnico = Date.now() + '-' + file.originalname;
        cb(null, nomeUnico);
    }
});
const upload = multer({ storage });

// Rotas…

// POST novo equipamento com termo opcional e QR Code condicional
const termoUpload = upload.single('termo');
app.post('/equipamentos', termoUpload, (req, res) => {
    console.log('BODY recebido:', req.body);
    console.log('Arquivo recebido:', req.file);
    const { categoria, nome, dono, setor, descricao, qrCode, existeQRCode } = req.body;
    const termo = req.file ? req.file.filename : null;
    if (
    !categoria ||
    !nome ||
    !dono ||
    !setor
) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
}



    const query = `
        INSERT INTO equipamentos 
        (categoria, nome, dono, setor, descricao, qrCode, termo) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [categoria, nome, dono, setor, descricao, qrCode, termo], (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ message: 'Equipamento cadastrado com sucesso!', id: result.insertId });
    });
});

app.get('/categorias', (req, res) => {
    const query = 'SELECT nome FROM categorias';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro ao buscar categorias:', err);
            return res.status(500).json({ error: 'Erro ao buscar categorias' });
        }
        const categorias = results.map(row => row.nome);
        res.json(categorias);
    });
});

app.post('/categorias', (req, res) => {
    const { categoria } = req.body;
    if (!categoria) {
        return res.status(400).json({ error: 'Categoria é obrigatória' });
    }
    const query = 'INSERT INTO categorias (nome) VALUES (?)';
    db.query(query, [categoria], (err, result) => {
        if (err) {
            console.error('Erro ao inserir categoria:', err);
            return res.status(500).json({ error: 'Erro ao inserir categoria' });
        }
        res.status(201).json({ message: 'Categoria adicionada com sucesso', id: result.insertId });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});

