const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '', // se você definiu senha no XAMPP, coloque aqui
  database: 'inventario_visteon',
  port: 3306 // porta explícita do MySQL
});

db.connect((err) => {
  if (err) {
    console.error('Erro ao conectar ao MySQL:', err.message);
    return;
  }
  console.log('Conectado ao banco de dados MySQL!');
});

module.exports = db;



