document.addEventListener('DOMContentLoaded', function() {
  // Navegação entre abas
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Botão Nova Categoria
  const btnNovaCategoria = document.getElementById('btn-nova-categoria');
  if (btnNovaCategoria) {
    btnNovaCategoria.addEventListener('click', () => {
      // Ativa a aba de formulário
      switchToTab('tab-form');
      
      // Reseta o formulário para modo de criação
      document.getElementById('form-titulo').innerHTML = '<i class="fas fa-plus-circle"></i> Nova Categoria';
      document.getElementById('categoria-form').reset();
    });
  }
  
  // Botões de edição na tabela
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      const row = this.closest('tr');
      const categoria = row.cells[0].textContent;
      const recebeTermo = row.cells[1].textContent === 'Sim';
      const id = this.getAttribute('data-id');
      
      // Ativa a aba de formulário
      switchToTab('tab-form');
      
      // Preenche o formulário com os dados da categoria
      document.getElementById('form-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
      document.getElementById('nome-categoria').value = categoria;
      document.getElementById('recebe-termo').checked = recebeTermo;
      
      // Adicione um campo hidden para o ID se necessário
      // document.getElementById('categoria-id').value = id;
    });
  });
  
  // Função auxiliar para mudar de aba
  function switchToTab(tabId) {
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    document.querySelector(`.tab-button[data-tab="${tabId}"]`).classList.add('active');
    document.getElementById(tabId).classList.add('active');
  }
});