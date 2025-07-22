const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const PORT = 3000;

app.use(cors());
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
const termoUpload = upload.single('termo');

// 🔄 POST novo equipamento com termo opcional e QR Code automático
app.post('/equipamentos', termoUpload, async (req, res) => {
    const { categoria, nome, dono, setor, descricao } = req.body;
    const termo = req.file ? req.file.filename : null;

    if (!categoria || !nome || !dono || !setor) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const identificador = uuidv4(); // 🔑 Gera identificador único
    const nomeQRCode = `${categoria}_${identificador}.png`.replace(/\s/g, '_');
    const caminhoQRCode = path.join(__dirname, 'uploads', nomeQRCode);

    try {
        await QRCode.toFile(caminhoQRCode, identificador, {
            width: 300,
            margin: 2
        });
    } catch (err) {
        console.error('Erro ao gerar QR Code:', err);
        return res.status(500).json({ error: 'Erro ao gerar QR Code.' });
    }

    const query = `
        INSERT INTO equipamentos 
        (categoria, nome, dono, setor, descricao, termo, qrCode) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(query, [categoria, nome, dono, setor, descricao, termo, identificador], (err, result) => {
        if (err) return res.status(400).json({ error: err.message });
        res.status(201).json({ message: 'Equipamento cadastrado com sucesso!', id: result.insertId });
    });
});

// 🔍 Listar categorias
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

// ➕ Adicionar categoria
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

// 📦 Listar equipamentos
app.get('/equipamentos', (req, res) => {
    const query = 'SELECT * FROM equipamentos';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Erro ao buscar equipamentos:', err);
            return res.status(500).json({ error: 'Erro ao buscar equipamentos.' });
        }
        res.json(results);
    });
});

// 🔎 Detalhes de um equipamento
app.get('/equipamentos/:id', (req, res) => {
    const { id } = req.params;
    const query = 'SELECT id, categoria, nome, dono, setor, descricao, termo, qrCode FROM equipamentos WHERE id = ?';
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Erro ao buscar equipamento:', err);
            return res.status(500).json({ error: 'Erro ao buscar equipamento.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'Equipamento não encontrado.' });
        }
        res.json(results[0]);
    });
});

// ✏️ Editar equipamento
app.put('/equipamentos/:id', express.json(), (req, res) => {
    const { id } = req.params;
    const { categoria, nome, dono, setor, descricao } = req.body;
    const query = 'UPDATE equipamentos SET categoria = ?, nome = ?, dono = ?, setor = ?, descricao = ? WHERE id = ?';
    db.query(query, [categoria, nome, dono, setor, descricao, id], (err) => {
        if (err) {
            console.error('Erro ao atualizar equipamento:', err);
            return res.status(500).json({ error: 'Erro ao atualizar equipamento.' });
        }
        res.json({ message: 'Equipamento atualizado com sucesso.' });
    });
});

// ❌ Excluir equipamento
app.delete('/equipamentos/:id', (req, res) => {
    const { id } = req.params;
    const query = 'DELETE FROM equipamentos WHERE id = ?';
    db.query(query, [id], (err) => {
        if (err) {
            console.error('Erro ao excluir equipamento:', err);
            return res.status(500).json({ error: 'Erro ao excluir equipamento.' });
        }
        res.json({ message: 'Equipamento excluído com sucesso.' });
    });
});

// 🚀 Inicializa servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
