const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SECRET = 'sua_chave_secreta';
const db = require('./db');

// Registrar usuário
app.post('/register', async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const sql = 'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)';

    db.query(sql, [nome, email, hash], (err) => {
        if (err) return res.status(400).json({ error: 'Erro ao registrar usuário ou email já cadastrado.' });
        res.status(201).json({ message: 'Cadastro realizado. Aguarde autorização do administrador.' });
    });
});

// Login
app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    db.query('SELECT * FROM usuarios WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) return res.status(400).json({ error: 'Usuário não encontrado.' });

        const usuario = results[0];

        if (!usuario.autorizado) {
            return res.status(403).json({ error: 'Usuário ainda não autorizado pelo administrador.' });
        }

        const isValid = await bcrypt.compare(senha, usuario.senha);
        if (!isValid) return res.status(401).json({ error: 'Senha incorreta.' });

        const token = jwt.sign({ id: usuario.id, admin: usuario.admin }, SECRET, { expiresIn: '1d' });
        res.json({ message: 'Login bem-sucedido', token });
    });

    // Middleware para checar se é admin
function verificarAdmin(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token ausente.' });

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Token inválido.' });
        if (!decoded.admin) return res.status(403).json({ error: 'Acesso negado.' });
        req.user = decoded;
        next();
    });
}

// Obter usuários não autorizados
app.get('/admin/pendentes', verificarAdmin, (req, res) => {
    db.query('SELECT id, nome, email FROM usuarios WHERE autorizado = FALSE', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Erro ao buscar usuários.' });
        res.json(rows);
    });
});

// Autorizar um usuário
app.post('/admin/autorizar', verificarAdmin, (req, res) => {
    const { id } = req.body;
    db.query('UPDATE usuarios SET autorizado = TRUE WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao autorizar usuário.' });
        res.json({ message: 'Usuário autorizado com sucesso.' });
    });
});
// Desautorizar um usuário
app.post('/admin/desautorizar', verificarAdmin, (req, res) => {
    const { id } = req.body;
    db.query('UPDATE usuarios SET autorizado = FALSE WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao desautorizar usuário.' });
        res.json({ message: 'Usuário desautorizado com sucesso.' });
    });
});
