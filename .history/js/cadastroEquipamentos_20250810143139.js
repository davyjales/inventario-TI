// cadastroEquipamentos.js
document.addEventListener("DOMContentLoaded", () => {
  const categoriaSelect = document.getElementById("categoria");
  const camposFixos = document.getElementById("campos-fixos");
  const camposAdicionaisContainer = document.getElementById("campos-adicionais-equipamento");
  const statusContainer = document.getElementById("status-container");
  const botaoCadastrar = document.getElementById("botao-cadastrar");
  const uploadTermoContainer = document.getElementById("upload-termo-container");

  let categoriasMap = new Map();

  // Carregar categorias na inicialização
  async function carregarCategorias() {
    try {
      const res = await fetch("/api/categorias");
      const categorias = await res.json();
      categoriaSelect.innerHTML = `<option value="">Selecione uma categoria</option>`;
      categorias.forEach(cat => {
        categoriasMap.set(cat.id, cat);
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.nome;
        categoriaSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar categorias:", err);
    }
  }

  // Carregar status
  async function carregarStatus() {
    try {
      const res = await fetch("/api/status");
      const statusList = await res.json();
      const statusSelect = document.getElementById("status");
      statusSelect.innerHTML = "";
      statusList.forEach(st => {
        const opt = document.createElement("option");
        opt.value = st.id;
        opt.textContent = st.nome;
        statusSelect.appendChild(opt);
      });
    } catch (err) {
      console.error("Erro ao carregar status:", err);
    }
  }

  // Buscar campos adicionais de uma categoria
  async function carregarCamposAdicionais(categoriaId) {
    try {
      const res = await fetch(`/api/categorias/${categoriaId}/campos`);
      const campos = await res.json();
      camposAdicionaisContainer.innerHTML = "";

      if (campos.length > 0) {
        campos.forEach(campo => {
          const div = document.createElement("div");
          div.classList.add("form-group");

          const label = document.createElement("label");
          label.textContent = campo.nome_campo + (campo.obrigatorio ? " *" : "");

          let input;
          switch (campo.tipo) {
            case "numero":
              input = document.createElement("input");
              input.type = "number";
              break;
            case "data":
              input = document.createElement("input");
              input.type = "date";
              break;
            case "lista":
              input = document.createElement("select");
              // Aqui você pode adicionar opções fixas ou vir do backend
              break;
            case "checkbox":
              input = document.createElement("input");
              input.type = "checkbox";
              break;
            default:
              input = document.createElement("input");
              input.type = "text";
          }

          input.name = `campo_${campo.id}`;
          if (campo.obrigatorio) input.required = true;

          div.appendChild(label);
          div.appendChild(input);
          camposAdicionaisContainer.appendChild(div);
        });
        camposAdicionaisContainer.classList.remove("hidden");
      } else {
        camposAdicionaisContainer.classList.add("hidden");
      }
    } catch (err) {
      console.error("Erro ao carregar campos adicionais:", err);
    }
  }

  // Mostrar campos ao selecionar categoria
  categoriaSelect.addEventListener("change", async (e) => {
    const categoriaId = e.target.value;

    if (!categoriaId) {
      camposFixos.classList.add("hidden");
      camposAdicionaisContainer.classList.add("hidden");
      statusContainer.classList.add("hidden");
      botaoCadastrar.classList.add("hidden");
      uploadTermoContainer.style.display = "none";
      return;
    }

    camposFixos.classList.remove("hidden");
    await carregarCamposAdicionais(categoriaId);
    await carregarStatus();

    statusContainer.classList.remove("hidden");
    botaoCadastrar.classList.remove("hidden");

    // Mostrar ou esconder campo de upload de termo baseado no recebe_termo da categoria
    const categoria = categoriasMap.get(parseInt(categoriaId));
    if (categoria && categoria.recebe_termo) {
      uploadTermoContainer.style.display = "block";
    } else {
      uploadTermoContainer.style.display = "none";
    }
  });

  // Inicialização
  carregarCategorias();
});
