const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: '10.137.174.213',
  user: 'root',
  password: '',
  database: 'inventario_visteon',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
