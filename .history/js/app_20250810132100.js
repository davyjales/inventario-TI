import { checkAuth, getToken, logout, setupLogout, setupAuth, abrirModalSenha, alterarSenha, isAdmin, isInventariante } from '../middlewares/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Use modular auth functions
    const user = checkAuth();
    if (!user) return; // Redirected to login if not authenticated

    setupAuth();

    // Use isAdmin and isInventariante from auth module
    const admin = isAdmin();
    const inventariante = isInventariante();

    // Setup logout button
    setupLogout();

    // The rest of the existing app.js code below, replacing inline auth logic with above modular calls

    // ... (rest of the existing code unchanged, but remove inline token checks and permission UI logic)

    // For example, remove:
    // let isAdmin = false;
    // let isInventariante = false;
    // const token = localStorage.getItem('token');
    // if (token) { ... } else { redirect }
    // and replace with above modular calls

    // Also replace modal password functions with calls to abrirModalSenha and alterarSenha from auth.js

    // The rest of the code remains as is, just remove duplicate auth logic

    // ... (rest of the code)
});
