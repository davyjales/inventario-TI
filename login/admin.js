const token = obterToken();
if (!token) logout();

async function carregarPendentes() {
  const res = await fetch(`${API_URL}/admin/pendentes`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const pendentes = await res.json();
  const ul = document.getElementById('usuarios-pendentes');
  ul.innerHTML = '';

  pendentes.forEach(user => {
    const li = document.createElement('li');
    li.textContent = `${user.nome} (${user.email})`;
    const btn = document.createElement('button');
    btn.textContent = 'Autorizar';
    btn.onclick = () => autorizar(user.id);
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

async function carregarAtivos() {
  const res = await fetch(`${API_URL}/admin/usuarios`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const usuarios = await res.json();

  const ul = document.getElementById('usuarios-ativos');
  ul.innerHTML = '';

  usuarios.forEach(user => {
    const li = document.createElement('li');
    li.textContent = `${user.nome} (${user.email}) ${user.admin ? '[Admin]' : ''}`;
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = user.admin ? 'Rebaixar' : 'Promover';
    toggleBtn.onclick = () => toggleAdmin(user.id, !user.admin);

    const excluirBtn = document.createElement('button');
    excluirBtn.textContent = 'Excluir';
    excluirBtn.onclick = () => excluirUsuario(user.id);

    li.appendChild(toggleBtn);
    li.appendChild(excluirBtn);
    ul.appendChild(li);
  });
}

async function autorizar(id) {
  await fetch(`${API_URL}/admin/autorizar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });
  carregarPendentes();
  carregarAtivos();
}

async function excluirUsuario(id) {
  await fetch(`${API_URL}/admin/excluir`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id })
  });
  carregarAtivos();
}

async function toggleAdmin(id, tornarAdmin) {
  await fetch(`${API_URL}/admin/toggleAdmin`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, admin: tornarAdmin })
  });
  carregarAtivos();
}

carregarPendentes();
carregarAtivos();
