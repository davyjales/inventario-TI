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
      // Limpar campos adicionais
      const camposContainer = document.getElementById('campos-container');
      camposContainer.innerHTML = '';
    });
  }
  
  // Botões de edição na tabela
  document.querySelectorAll('.edit-btn').forEach(button => {
    button.addEventListener('click', async function(e) {
      e.preventDefault();
      const id = this.getAttribute('data-id');
      
      // Buscar dados da categoria e campos adicionais via API
      try {
        const token = localStorage.getItem('token');
        const resCategoria = await fetch(`/api/categorias/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const categoria = await resCategoria.json();
        
        const resCampos = await fetch(`/api/categorias/${id}/campos`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const campos = await resCampos.json();
        
        // Ativa a aba de formulário
        switchToTab('tab-form');
        
        // Preenche o formulário com os dados da categoria
        document.getElementById('form-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Categoria';
        document.getElementById('nome-categoria').value = categoria.nome;
        document.getElementById('recebe-termo').checked = categoria.recebe_termo;
        
        // Preenche os campos adicionais
        const camposContainer = document.getElementById('campos-container');
        camposContainer.innerHTML = '';
        campos.forEach(campo => {
          const div = document.createElement('div');
          div.classList.add('campo-item');
          div.innerHTML = `
            <input type="text" class="campo-nome" placeholder="Nome do campo" value="${campo.nome_campo || ''}" required />
            <select class="campo-tipo">
              <option value="texto" ${campo.tipo === "texto" ? "selected" : ""}>Texto</option>
              <option value="numero" ${campo.tipo === "numero" ? "selected" : ""}>Número</option>
              <option value="data" ${campo.tipo === "data" ? "selected" : ""}>Data</option>
              <option value="lista" ${campo.tipo === "lista" ? "selected" : ""}>Lista</option>
              <option value="checkbox" ${campo.tipo === "checkbox" ? "selected" : ""}>Checkbox</option>
            </select>
            <label>
              Obrigatório
              <input type="checkbox" class="campo-obrigatorio" ${campo.obrigatorio ? "checked" : ""} />
            </label>
            <label>
              Único
              <input type="checkbox" class="campo-unico" ${campo.conteudo_unico ? "checked" : ""} />
            </label>
            <button type="button" class="btn-remover-campo">Remover</button>
          `;
          div.querySelector('.btn-remover-campo').addEventListener('click', () => {
            div.remove();
          });
          camposContainer.appendChild(div);
        });
      } catch (error) {
        console.error('Erro ao carregar dados da categoria:', error);
        alert('Erro ao carregar dados da categoria para edição.');
      }
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
