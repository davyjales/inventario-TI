const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Para servir arquivos PDF

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

// GET equipamentos
app.get('/equipamentos', (req, res) => {
    db.query('SELECT * FROM equipamentos', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// GET equipamento por ID
app.get('/equipamentos/:id', (req, res) => {
    db.query('SELECT * FROM equipamentos WHERE id = ?', [req.params.id], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Equipamento não encontrado.' });
        res.json(results[0]);
    });
});

// POST novo equipamento com termo opcional
app.post('/equipamentos', upload.single('termo'), (req, res) => {
    const { categoria, nome, dono, setor, descricao, qrCode } = req.body;
    const termo = req.file ? `/uploads/${req.file.filename}` : null;

    if (!categoria || !nome || !dono || !setor || !qrCode) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const query = 'INSERT INTO equipamentos (categoria, nome, dono, setor, descricao, qrCode, termo) VALUES (?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [categoria, nome, dono, setor, descricao, qrCode, termo], (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ message: 'Equipamento cadastrado com sucesso!', id: result.insertId });
    });
});

// DELETE equipamento
app.delete('/equipamentos/:id', (req, res) => {
    db.query('DELETE FROM equipamentos WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Equipamento excluído com sucesso.' });
    });
});

// GET categorias
app.get('/categorias', (req, res) => {
    db.query('SELECT nome FROM categorias', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results.map(row => row.nome));
    });
});

// POST nova categoria
app.post('/categorias', (req, res) => {
    const { categoria } = req.body;
    if (!categoria) return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });

    db.query('INSERT INTO categorias (nome) VALUES (?)', [categoria], (err, result) => {
        if (err) {
            console.error('Erro ao inserir categoria:', err);
            return res.status(400).json({ error: err.message });
        }
        res.status(201).json({ message: 'Categoria adicionada com sucesso!' });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
