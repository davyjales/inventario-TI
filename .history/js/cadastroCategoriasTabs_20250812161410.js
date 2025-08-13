document.addEventListener('DOMContentLoaded', function() {
  // Navegação entre abas
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      // Remove classe active de todos os botões e conteúdos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Adiciona classe active ao botão e conteúdo clicado
      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Botão Nova Categoria
  const btnNovaCategoria = document.getElementById('btn-nova-categoria');
  if (btnNovaCategoria) {
    btnNovaCategoria.addEventListener('click', () => {
      // Remove classe active de todos os botões e conteúdos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Ativa a aba de formulário
      document.querySelector('.tab-button[data-tab="tab-form"]').classList.add('active');
      document.getElementById('tab-form').classList.add('active');
      
      // Reseta o formulário para modo de criação
      document.getElementById('form-titulo').innerHTML = '<i class="fas fa-plus-circle"></i> Nova Categoria';
      document.getElementById('categoria-form').reset();
    });
  }
  
  // Botões de edição na tabela
  const editButtons = document.querySelectorAll('.edit-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const row = button.closest('tr');
      const categoria = row.cells[0].textContent;
      const recebeTermo = row.cells[1].textContent === 'Sim';
      
      // Remove classe active de todos os botões e conteúdos
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Ativa a aba de formulário
      document.querySelector('.tab-button[data-tab="tab-form"]').classList.add('active');
      document.getElementById('tab-form').classList.add('active');
      
      // Preenche o formulário com os dados da categoria
      document.getElementById('form-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
      document.getElementById('nome-categoria').value = categoria;
      document.getElementById('recebe-termo').checked = recebeTermo;
    });
  });
});