document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();

  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;
  const API_URL = 'http://localhost:3000'; // ou seu endpoint real

  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, email, senha })
  });

  const data = await res.json();
  alert(data.message || data.error);

  if (res.ok) window.location.href = '/login/login.html';
});
