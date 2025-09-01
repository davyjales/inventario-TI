const jwt = require('jsonwebtoken');
const SECRET = 'segredo_supersecreto';

function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ erro: 'Token ausente' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.status(403).json({ erro: 'Token inválido' });
    req.user = user;
    next();
  });
}

function verificarAdmin(req, res, next) {
  if (!req.user.admin) return res.status(403).json({ erro: 'Acesso negado' });
  next();
}

function verificarInventarianteOuAdmin(req, res, next) {
  if (!req.user.admin && !req.user.inventariante) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

module.exports = { autenticarToken, verificarAdmin, verificarInventarianteOuAdmin, SECRET };
