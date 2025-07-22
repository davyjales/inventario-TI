const API_URL = 'http://localhost:3000';
const TOKEN_KEY = 'token';

function salvarToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function obterToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function logout() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = 'index.html';
}
