const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: 'localhost',
  user: 'suporte',
  password: 'InicioOK2015',
  database: 'inventario_visteon',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
