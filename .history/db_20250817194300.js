const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '10.218.172.40',
  user: 'root',
  password: '',
  database: 'inventario_ti',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;



