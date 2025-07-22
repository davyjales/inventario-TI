// loginUtils.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const adminLink = document.getElementById('admin-link');
    const logoutButton = document.getElementById('btn-logout');

    // Redireciona para login se não estiver autenticado
   /* if (!token) {
        window.location.href = 'login/login.html';
        return;
    }*/

    // Decodifica token para saber se é admin
    const payload = parseJwt(token);
    if (payload?.admin) {
        adminLink.style.display = 'inline';
    }

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login/login.html';
    });
});

// Função auxiliar para decodificar o JWT (não valida assinatura, apenas lê payload)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}
