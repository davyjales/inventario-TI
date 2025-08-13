// cadastroCategorias.js

document.addEventListener("DOMContentLoaded", () => {
  const listaCategoriasTbody = document.getElementById("categorias-tbody");
  const btnNovaCategoria = document.getElementById("btn-nova-categoria");
  const formCategoriaSection = document.getElementById("tab-form");
  const listaCategoriasSection = document.getElementById("tab-lista");
  const categoriaForm = document.getElementById("categoria-form");
  const nomeCategoriaInput = document.getElementById("nome-categoria");
  const recebeTermoCheckbox = document.getElementById("recebe-termo");
  const camposContainer = document.getElementById("campos-container");
  const btnAdicionarCampo = document.getElementById("btn-adicionar-campo");
  const btnCancelar = document.getElementById("btn-cancelar");
  const formTitulo = document.getElementById("form-titulo");

  let categorias = [];
  let editandoCategoriaId = null;

  // Função para criar um campo de input para os campos da categoria
  function criarCampoInput(campo = {}) {
    const div = document.createElement("div");
    div.classList.add("campo-item");

    div.innerHTML = `
      <input type="text" class="campo-nome" placeholder="Nome do campo" value="${campo.nome || ''}" required />
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

    // Remover campo
    div.querySelector(".btn-remover-campo").addEventListener("click", () => {
      div.remove();
    });

    return div;
  }

  // Carregar categorias da API
  async function carregarCategorias() {
    try {
      const res = await fetch("/api/categorias");
      categorias = await res.json();
      renderizarListaCategorias();
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  }

  // Renderizar lista de categorias na tabela
  function renderizarListaCategorias() {
    listaCategoriasTbody.innerHTML = "";
    categorias.forEach(cat => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="categoria">${cat.nome}</td>
        <td class="recebe-termo">${cat.recebe_termo ? "Sim" : "Não"}</td>
        <td class="acoes">
          <div class="status-actions">
            <button class="status-btn edit-btn" data-id="${cat.id}" title="Editar">
              <i class="fas fa-edit"></i>
            </button>
            <button class="status-btn delete-btn" data-id="${cat.id}" title="Excluir">
              <i class="fas fa-trash-alt"></i>
            </button>
          </div>
        </td>
      `;
      listaCategoriasTbody.appendChild(tr);
    });

    // Adicionar eventos aos botões editar e excluir
    document.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        abrirFormularioEdicao(id);
      });
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        excluirCategoria(id);
      });
    });
  }

  // Abrir formulário para nova categoria
  btnNovaCategoria.addEventListener("click", () => {
    editandoCategoriaId = null;
    formTitulo.textContent = "Nova Categoria";
    nomeCategoriaInput.value = "";
    recebeTermoCheckbox.checked = false;
    camposContainer.innerHTML = "";
    mostrarFormulario(true);
  });

  // Abrir formulário para edição de categoria
  async function abrirFormularioEdicao(id) {
    const categoria = categorias.find(c => c.id == id);
    if (!categoria) return;

    editandoCategoriaId = id;
    formTitulo.textContent = "Editar Categoria";
    nomeCategoriaInput.value = categoria.nome;
    recebeTermoCheckbox.checked = categoria.recebe_termo;

    // Carregar campos da categoria
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/categorias/${id}/campos`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const campos = await res.json();
      camposContainer.innerHTML = "";
      campos.forEach(campo => {
        camposContainer.appendChild(criarCampoInput(campo));
      });
    } catch (err) {
      console.error("Erro ao carregar campos da categoria:", err);
    }

    mostrarFormulario(true);

    // Trigger click on form tab button to activate it
    const formTabButton = document.querySelector('.tab-button[data-tab="tab-form"]');
    if (formTabButton) {
      formTabButton.click();
    }
  }

  // Mostrar ou esconder formulário
  function mostrarFormulario(mostrar) {
    if (mostrar) {
      formCategoriaSection.classList.remove("hidden");
      listaCategoriasSection.classList.add("hidden");
    } else {
      formCategoriaSection.classList.add("hidden");
      listaCategoriasSection.classList.remove("hidden");
    }
  }

  // Adicionar novo campo no formulário
  btnAdicionarCampo.addEventListener("click", () => {
    camposContainer.appendChild(criarCampoInput());
  });

  // Cancelar edição/criação
  btnCancelar.addEventListener("click", () => {
    mostrarFormulario(false);
  });

  // Excluir categoria
  async function excluirCategoria(id) {
    if (!confirm("Tem certeza que deseja excluir esta categoria?")) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para excluir categorias.');
        return;
      }

      const res = await fetch(`/api/categorias/${id}`, {
        method: "DELETE",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        categorias = categorias.filter(c => c.id != id);
        renderizarListaCategorias();
      } else if (res.status === 401) {
        alert('Erro de autenticação. Por favor, faça login novamente.');
        window.location.href = '/login.html';
      } else if (res.status === 403) {
        alert('Você não tem permissão para excluir esta categoria.');
      } else {
        alert("Erro ao excluir categoria");
      }
    } catch (err) {
      console.error("Erro ao excluir categoria:", err);
    }
  }

  // Salvar categoria (criar ou atualizar)
  categoriaForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nome = nomeCategoriaInput.value.trim();
    const recebe_termo = recebeTermoCheckbox.checked;

    const campos = [];
    camposContainer.querySelectorAll(".campo-item").forEach(div => {
      const nome_campo = div.querySelector(".campo-nome").value.trim();
      const tipo = div.querySelector(".campo-tipo").value;
      const obrigatorio = div.querySelector(".campo-obrigatorio").checked;
      const conteudo_unico = div.querySelector(".campo-unico").checked;

      if (nome_campo) {
        campos.push({ nome_campo, tipo, obrigatorio, conteudo_unico });
      }
    });

    const payload = { nome, recebe_termo, campos };

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Você precisa estar logado para salvar categorias.');
        return;
      }

      let res;
      if (editandoCategoriaId) {
        res = await fetch(`/api/categorias/${editandoCategoriaId}`, {
          method: "PUT",
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/categorias", {
          method: "POST",
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify(payload),
        });
      }

      if (res.ok) {
        await carregarCategorias();
        mostrarFormulario(false);
      } else if (res.status === 401) {
        alert('Erro de autenticação. Por favor, faça login novamente.');
        window.location.href = '/login.html';
      } else if (res.status === 403) {
        alert('Você não tem permissão para salvar categorias.');
      } else {
        alert("Erro ao salvar categoria");
      }
    } catch (err) {
      console.error("Erro ao salvar categoria:", err);
    }
  });

  // Inicialização
  carregarCategorias();
});
