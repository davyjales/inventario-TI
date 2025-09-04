// public/js/modules/auth.js
import jwt_decode from 'https://cdn.jsdelivr.net/npm/jwt-decode/build/jwt-decode.min.js';

// Configurações compartilhadas (poderia vir de um arquivo de configuração)
const API_BASE_URL = 'http://10.218.172.40:3000';
const TOKEN_KEY = 'inventario_token';

let idUsuarioAlterandoSenha = null;

// Função para fazer login (pode ser usada no login.js)
export async function login(username, password) {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      throw new Error('Credenciais inválidas');
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    return true;
  } catch (error) {
    console.error('Erro no login:', error);
    return false;
  }
}

// Verifica autenticação e retorna o usuário decodificado
export function checkAuth() {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }

  try {
    const decoded = jwt_decode(token);
    return decoded;
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    logout();
    return null;
  }
}

// Obtém o token armazenado
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

// Redireciona para a página de login
export function redirectToLogin() {
  window.location.href = 'login.html';
}

// Faz logout
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  redirectToLogin();
}

// Configura o botão de logout
export function setupLogout() {
  const logoutBtn = document.getElementById('logout-link');
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    logout();
  });
}

// Modal de alteração de senha
export function abrirModalSenha(id, nome) {
  idUsuarioAlterandoSenha = id;
  document.getElementById('modal-title').innerText = `Alterar senha de ${nome}`;
  document.getElementById('nova-senha').value = '';
  document.getElementById('modal-senha').classList.remove('hidden');
}

// Função para alterar senha (usada no modal)
export async function alterarSenha(novaSenha) {
  if (!idUsuarioAlterandoSenha || novaSenha.length < 6) {
    return { success: false, message: 'Senha inválida' };
  }

  try {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/admin/alterar-senha/${idUsuarioAlterandoSenha}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ novaSenha })
    });

    if (!response.ok) {
      const data = await response.json();
      return { success: false, message: data.erro || 'Erro ao alterar senha' };
    }

    return { success: true, message: 'Senha alterada com sucesso!' };
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    return { success: false, message: 'Erro de conexão' };
  }
}

// Verifica se o usuário é admin
export function isAdmin() {
  const user = checkAuth();
  return user?.admin || false;
}

// Verifica se o usuário é inventariante
export function isInventariante() {
  const user = checkAuth();
  return user?.inventariante || false;
}

// Configurações iniciais de autenticação
export function setupAuth() {
  // Verifica autenticação ao carregar a página
  const user = checkAuth();
  
  // Mostra/oculta links baseado nas permissões
  if (user) {
    if (user.admin) {
      document.getElementById('admin-link').style.display = 'inline-block';
      document.getElementById('admin').style.display = 'block';
    }
    
    if (!user.admin && !user.inventariante) {
      document.getElementById('form-categoria')?.remove();
      document.getElementById('cadastro')?.remove();
      document.querySelector('a[href="#cadastro"]')?.remove();
      document.getElementById('btn-cadastrar')?.remove();
    }
  }
  
  // Configura logout
  setupLogout();
}