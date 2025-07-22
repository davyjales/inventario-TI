document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha })
  });

  const data = await res.json();
  if (!res.ok) {
    alert(data.error);
    return;
  }

  salvarToken(data.token);

  const payload = JSON.parse(atob(data.token.split('.')[1]));
  if (payload.admin) {
    window.location.href = '../index.html';
  } else {
    alert('Login realizado. Aguarde autorização do administrador.');
  }
});
