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

    // Debug: ver o que está sendo enviado
    console.log('Enviando para login:', { user, senha });

    try {
      const response = await fetch('http://10.218.172.40:3000/api/usuarios/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, senha })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Resposta inválida do servidor');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro no login');
      }

      // Salvar token e redirecionar
      localStorage.setItem('token', data.token);
      window.location.href = 'index.html';
    } catch (err) {
      console.error('Erro no login:', err);
      alert('Erro: ' + err.message);
    }
  });
});

