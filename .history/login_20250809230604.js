document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = document.getElementById('user').value.trim();
    const senha = document.getElementById('senha').value.trim();

    if (!user || !senha) {
      alert('Preencha todos os campos!');
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: senha }) // ⚠ ajustar nomes para o backend
      });


      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no login');
      }

      // ✅ Salvar token no localStorage e redirecionar
      localStorage.setItem('token', data.token);
      window.location.href = 'index.html';
    } catch (err) {
      alert('Erro: ' + err.message);
    }
  });
});
