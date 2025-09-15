export async function abrirModalEditarEquipamento(id) {
  try {
    // Fetch equipment data by ID
    const res = await fetch(`/api/equipamentos/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const equipamento = await res.json();

    // Populate edit form fields
    const editId = document.getElementById('edit-equipment-id');
    const editCategoria = document.getElementById('edit-categoria');
    const editNome = document.getElementById('edit-nome');
    const editDono = document.getElementById('edit-dono');
    const editSetor = document.getElementById('edit-setor');
    const editCargo = document.getElementById('edit-cargo');
    const editDescricao = document.getElementById('edit-descricao');
    const editStatus = document.getElementById('edit-status');

    if (editId) editId.value = equipamento.id ?? '';
    if (editCategoria) editCategoria.value = equipamento.categoria_id ?? '';
    if (editNome) editNome.value = equipamento.nome ?? '';
    if (editDono) editDono.value = equipamento.dono ?? '';
    if (editSetor) editSetor.value = equipamento.setor ?? '';
    if (editCargo) editCargo.value = equipamento.cargo ?? '';
    if (editDescricao) editDescricao.value = equipamento.descricao ?? '';
    if (editStatus) editStatus.value = equipamento.status_id ?? '';

    // Load categories and statuses for the edit modal selects
    async function loadEditSelects() {
      try {
        const [catRes, statusRes] = await Promise.all([
          fetch('/api/categorias'),
          fetch('/api/status')
        ]);
        if (!catRes.ok || !statusRes.ok) throw new Error('Erro ao carregar categorias ou status');
        const [categories, statuses] = await Promise.all([catRes.json(), statusRes.json()]);

        if (editCategoria) {
          editCategoria.innerHTML = '';
          categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.nome;
            editCategoria.appendChild(option);
          });
        }

        if (editStatus) {
          editStatus.innerHTML = '';
          statuses.forEach(st => {
            const option = document.createElement('option');
            option.value = st.id;
            option.textContent = st.nome;
            editStatus.appendChild(option);
          });
        }

        // Set the selected values after loading options
        if (editCategoria) editCategoria.value = equipamento.categoria_id ?? '';
        if (editStatus) editStatus.value = equipamento.status_id ?? '';
      } catch (e) {
        console.error('Erro ao carregar categorias ou status para edição:', e);
      }
    }

    // Render additional fields in the edit modal (aceita objeto ou array)
    async function renderAdditionalFields(additionalFields, categoriaId) {
      const container = document.getElementById('edit-additional-fields-container');
      if (!container) return;
      container.innerHTML = '';

      // normalize entries: [[name, value], ...]
      let entries = [];
      if (!additionalFields) {
        entries = [];
      } else if (Array.isArray(additionalFields)) {
        // array de { name, value }
        entries = additionalFields.map(f => [f.name, f.value]);
      } else if (typeof additionalFields === 'object') {
        entries = Object.entries(additionalFields);
      }

      if (entries.length === 0) return;

      try {
        // Fetch category additional fields metadata (optional, para nomes exibidos)
        const res = await fetch(`/api/categorias/${categoriaId}/campos`);
        if (!res.ok) {
          // se der problema com meta, ainda renderizamos com nomes formatados
          console.warn('Não foi possível carregar metadados dos campos adicionais');
        }
        const camposMeta = res.ok ? await res.json() : [];

        // map por id e por nome_campo (ex.: "campo_14")
        const nomeCampoMap = {};
        (camposMeta || []).forEach(campo => {
          const display = campo.nome_exibicao || campo.nome_campo || campo.id;
          if (campo.id != null) nomeCampoMap[campo.id] = display;
          if (campo.nome_campo) nomeCampoMap[campo.nome_campo] = display;
        });

        function formatFieldName(name) {
          if (!name) return '';
          let formatted = name;
          if (formatted.startsWith('campo_')) formatted = formatted.replace('campo_', '');
          formatted = formatted.replace(/_/g, ' ');
          formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
          return formatted;
        }

        entries.forEach(([key, value]) => {
          const div = document.createElement('div');
          div.classList.add('form-group');

          const label = document.createElement('label');
          label.textContent = nomeCampoMap[key] || formatFieldName(key);

          const input = document.createElement('input');
          input.type = 'text';
          input.name = `additional_${key}`;
          input.value = value ?? '';

          div.appendChild(label);
          div.appendChild(input);
          container.appendChild(div);
        });
      } catch (e) {
        console.error('Erro ao carregar campos adicionais para edição:', e);
      }
    }

    await loadEditSelects();
    await renderAdditionalFields(equipamento.additionalFields, equipamento.categoria_id);

    // Show the edit modal
    const modal = document.getElementById('edit-equipment-modal');
    if (!modal) {
      console.error('Modal de edição não encontrado');
      return;
    }
    modal.classList.remove('hidden');

    // ---- Cancel button: attach handler once, and force type="button" para evitar submit ----
    const cancelBtn = modal.querySelector('#cancel-edit') || document.getElementById('cancel-edit');
    if (cancelBtn) {
      // se for <button> sem type, forçamos type="button" pra não submeter o form
      if (cancelBtn.tagName.toLowerCase() === 'button' && !cancelBtn.hasAttribute('type')) {
        cancelBtn.setAttribute('type', 'button');
      }
      if (!cancelBtn.dataset.cancelHandlerAttached) {
        cancelBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          modal.classList.add('hidden');
        });
        cancelBtn.dataset.cancelHandlerAttached = '1';
      }
    } else {
      console.warn('Botão cancelar (#cancel-edit) não encontrado no modal.');
    }

    // ---- Form submit: attach handler once ----
    const editForm = modal.querySelector('#edit-equipment-form') || document.getElementById('edit-equipment-form');
    if (editForm) {
      if (!editForm.dataset.submitHandlerAttached) {
        editForm.addEventListener('submit', async (e) => {
          e.preventDefault();

          try {
            const idVal = (document.getElementById('edit-equipment-id') || {}).value;
            const formData = new FormData();

            // Collect basic data safely (verifique se os elementos existem)
            const getVal = (sel) => (document.getElementById(sel) ? document.getElementById(sel).value : '');
            formData.append('categoria_id', getVal('edit-categoria'));
            formData.append('nome', getVal('edit-nome'));
            formData.append('dono', getVal('edit-dono'));
            formData.append('setor', getVal('edit-setor'));
            formData.append('cargo', getVal('edit-cargo'));
            formData.append('descricao', getVal('edit-descricao'));
            formData.append('status_id', getVal('edit-status'));

            // Collect additional fields
            const additionalFields = [];
            const additionalInputs = document.querySelectorAll('#edit-additional-fields-container input[type="text"]');
            additionalInputs.forEach(input => {
              const fieldName = input.name.replace('additional_', '');
              additionalFields.push({
                name: fieldName,
                value: input.value
              });
            });

            if (additionalFields.length > 0) {
              formData.append('additionalFields', JSON.stringify(additionalFields));
            }

            // Send PUT request
            const response = await fetch(`/api/equipamentos/${idVal}`, {
              method: 'PUT',
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              },
              body: formData
            });

            const result = await response.json();

            if (response.ok) {
              alert('Equipamento atualizado com sucesso!');
              modal.classList.add('hidden');
              window.location.reload();
            } else {
              alert(`Erro ao salvar: ${result.error || 'Erro desconhecido'}`);
            }
          } catch (error) {
            console.error('Erro ao salvar equipamento:', error);
            alert('Erro ao salvar equipamento. Tente novamente.');
          }
        });
        editForm.dataset.submitHandlerAttached = '1';
      }
    } else {
      console.warn('Form de edição (#edit-equipment-form) não encontrado.');
    }

  } catch (err) {
    console.error('Erro ao carregar equipamento para edição:', err);
    alert('Erro ao carregar equipamento para edição.');
  }
}
