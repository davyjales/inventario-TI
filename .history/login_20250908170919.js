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

    // Debug: conferir dados antes do envio
    console.log('Enviando para login:', { user, senha });

    try {
      const response = await fetch('http://10.137.174.213:3000/api/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, senha }) // ✅ Agora o backend vai receber certinho
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro no login');
      }

      // ✅ Salvar token e redirecionar
      localStorage.setItem('token', data.token);
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Erro no login:', err);
      alert('Erro: ' + err.message);
    }
  });
});
