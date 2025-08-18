// cadastroEquipamentos.js
document.addEventListener("DOMContentLoaded", () => {
  const categoriaSelect = document.getElementById("categoria");
  const camposFixos = document.getElementById("campos-fixos");
  const camposAdicionaisContainer = document.getElementById("campos-adicionais-equipamento");
  const statusContainer = document.getElementById("status-container");
  const botaoCadastrar = document.getElementById("botao-cadastrar");
  const uploadTermoContainer = document.getElementById("upload-termo-container");
  const formCadastro = document.getElementById("form-cadastro");

  let categoriasMap = new Map();

  // Carregar categorias na inicialização
  async function carregarCategorias() {
    try {
      const res = await fetch("/api/categorias");
      const categorias = await res.json();
      console.log("Categorias carregadas:", categorias);
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
      console.log("Campos adicionais carregados para categoria", categoriaId, campos);
      camposAdicionaisContainer.innerHTML = "";

      if (campos.length > 0) {
        campos.forEach(async (campo) => {
          const div = document.createElement("div");
          div.classList.add("form-group");
        
          const label = document.createElement("label");
          // Use nome_exibicao if available, else fallback to nome_campo
          label.textContent = campo.nome_exibicao || campo.nome_campo || 'Campo adicional' + (campo.obrigatorio ? " *" : "");
        
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
        
              // Use options from the campo itself
              if (campo.opcoes && Array.isArray(campo.opcoes)) {
                campo.opcoes.forEach(option => {
                  const opt = document.createElement("option");
                  opt.value = typeof option === 'string' ? option : option.value || option;
                  opt.textContent = typeof option === 'string' ? option : option.label || option;
                  input.appendChild(opt);
                });
              } else {
                // Fallback if no options are provided
                const opt = document.createElement("option");
                opt.value = "";
                opt.textContent = "Sem opções disponíveis";
                input.appendChild(opt);
              }
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
    console.log("Categoria selecionada:", categoriaId);

    if (!categoriaId) {
      console.log("Nenhuma categoria selecionada, ocultando campos.");
      camposFixos.classList.add("hidden");
      camposAdicionaisContainer.classList.add("hidden");
      statusContainer.classList.add("hidden");
      botaoCadastrar.classList.add("hidden");
      uploadTermoContainer.style.display = "none";
      return;
    }

    camposFixos.classList.remove("hidden");
    console.log("Mostrando campos fixos.");

    await carregarCamposAdicionais(categoriaId);
    await carregarStatus();

    statusContainer.classList.remove("hidden");
    botaoCadastrar.classList.remove("hidden");
    console.log("Mostrando status e botão cadastrar.");

    // Mostrar ou esconder campo de upload de termo baseado no recebe_termo da categoria
    const categoria = categoriasMap.get(parseInt(categoriaId));
    const existeTermoRadioGroup = document.querySelector('.form-group-inline');
    if (categoria && categoria.recebe_termo) {
      uploadTermoContainer.style.display = "block";
      if (existeTermoRadioGroup) {
        existeTermoRadioGroup.style.display = "flex";
      }
      console.log("Mostrando upload de termo e pergunta existe termo.");
    } else {
      uploadTermoContainer.style.display = "none";
      if (existeTermoRadioGroup) {
        existeTermoRadioGroup.style.display = "none";
      }
      console.log("Ocultando upload de termo e pergunta existe termo.");
    }
  });

  // Handle form submission
  if (formCadastro) {
    formCadastro.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const formData = new FormData(formCadastro);
      
      // Coletar campos adicionais
      const additionalFields = [];
      const camposInputs = camposAdicionaisContainer.querySelectorAll('input, select');
      camposInputs.forEach(input => {
        if (input.name && input.value) {
          let fieldName = input.name;
          if (fieldName.startsWith('campo_')) {
            fieldName = fieldName.substring(6);
          }
          additionalFields.push({
            name: fieldName,
            value: input.value
          });
        }
      });
      
      if (additionalFields.length > 0) {
        formData.append('additionalFields', JSON.stringify(additionalFields));
      }

      try {
        const token = localStorage.getItem('token');
        const statusSelect = document.getElementById("status");
        if (statusSelect) {
          formData.append('status_id', statusSelect.value);
        }
        const res = await fetch("/api/equipamentos", {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        const data = await res.json();
        
        if (res.ok) {
          alert("Equipamento cadastrado com sucesso!");
          formCadastro.reset();
          camposAdicionaisContainer.innerHTML = "";
          camposFixos.classList.add("hidden");
          camposAdicionaisContainer.classList.add("hidden");
          statusContainer.classList.add("hidden");
          botaoCadastrar.classList.add("hidden");
          uploadTermoContainer.style.display = "none";
        } else {
          alert("Erro ao cadastrar equipamento: " + (data.error || "Erro desconhecido"));
        }
      } catch (err) {
        console.error("Erro ao cadastrar equipamento:", err);
        alert("Erro ao cadastrar equipamento: " + err.message);
      }
    });
  }

  // Controle de upload de termo
  const radiosTermo = document.querySelectorAll('input[name="existeTermo"]');
  radiosTermo.forEach(radio => {
    radio.addEventListener("change", (e) => {
      if (e.target.value === "sim") {
        uploadTermoContainer.style.display = "block";
      } else {
        uploadTermoContainer.style.display = "none";
      }
    });
  });

  // Inicialização
  carregarCategorias();
});
