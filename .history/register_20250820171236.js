document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const nome = document.getElementById('nome').value.trim();
  const email = document.getElementById('email').value.trim();
  const user = document.getElementById('user').value.trim();
  const senha = document.getElementById('senha').value.trim();

  if (!nome || !email || !user || !senha) {
    alert('Por favor, preencha todos os campos.');
    return;
  }

  try {
    const res = await fetch('http://localhost:3000/api/usuarios/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nome, email, user, senha })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao registrar usuário.');
    }

    alert('Usuário registrado com sucesso!');
    window.location.href = 'login.html';
  } catch (err) {
    alert(err.message);
  }
});
