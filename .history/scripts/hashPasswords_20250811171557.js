const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function hashPlainPasswords() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '', // ajuste conforme seu banco
    database: 'inventario'
  });

  const [users] = await connection.execute('SELECT id, senha FROM usuarios');

  for (const user of users) {
    const senha = user.senha;
    // Verifica se a senha já está com hash bcrypt (começa com $2b$)
    if (!senha.startsWith('$2b$')) {
      const hashed = await bcrypt.hash(senha, 10);
      await connection.execute('UPDATE usuarios SET senha = ? WHERE id = ?', [hashed, user.id]);
      console.log(`Senha do usuário ${user.id} atualizada com hash.`);
    }
  }

  await connection.end();
  console.log('Atualização de senhas concluída.');
}

hashPlainPasswords().catch(console.error);
