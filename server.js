const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

const dataFilePath = path.join(__dirname, 'data.json');

// Initialize data file if not exists
if (!fs.existsSync(dataFilePath)) {
    const initialData = {
        equipamentos: [],
        categorias: ['Notebooks', 'Desktops', 'Celulares', 'Mouses', 'Teclados', 'Monitores', 'Cabos HDMI', 'Cabos VGA', 'Adaptadores']
    };
    fs.writeFileSync(dataFilePath, JSON.stringify(initialData, null, 2));
}

// Helper to read data
function readData() {
    const rawData = fs.readFileSync(dataFilePath);
    return JSON.parse(rawData);
}

// Helper to write data
function writeData(data) {
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
}

// Get all equipamentos
app.get('/equipamentos', (req, res) => {
    const data = readData();
    res.json(data.equipamentos);
});

// Add new equipamento
app.post('/equipamentos', (req, res) => {
    const { categoria, nome, dono, setor, descricao, qrCode } = req.body;
    if (!categoria || !nome || !dono || !setor || !qrCode) {
        return res.status(400).json({ error: 'Campos obrigatórios faltando.' });
    }

    const data = readData();

    // Check for duplicate QR Code
    if (data.equipamentos.some(eq => eq.qrCode === qrCode)) {
        return res.status(400).json({ error: 'Já existe um equipamento com este QR Code.' });
    }

    const novoEquip = { categoria, nome, dono, setor, descricao, qrCode };
    data.equipamentos.push(novoEquip);
    writeData(data);

    res.status(201).json({ message: 'Equipamento cadastrado com sucesso!' });
});

// Get all categorias
app.get('/categorias', (req, res) => {
    const data = readData();
    res.json(data.categorias);
});

// Add new categoria
app.post('/categorias', (req, res) => {
    const { categoria } = req.body;
    if (!categoria) {
        return res.status(400).json({ error: 'Nome da categoria é obrigatório.' });
    }

    const data = readData();

    if (data.categorias.includes(categoria)) {
        return res.status(400).json({ error: 'Categoria já existe.' });
    }

    data.categorias.push(categoria);
    writeData(data);

    res.status(201).json({ message: 'Categoria adicionada com sucesso!' });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
