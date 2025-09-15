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

    if (editId) editId.value = equipamento.id || '';
    if (editCategoria) editCategoria.value = equipamento.categoria_id || '';
    if (editNome) editNome.value = equipamento.nome || '';
    if (editDono) editDono.value = equipamento.dono || '';
    if (editSetor) editSetor.value = equipamento.setor || '';
    if (editCargo) editCargo.value = equipamento.cargo || '';
    if (editDescricao) editDescricao.value = equipamento.descricao || '';
    if (editStatus) editStatus.value = equipamento.status_id || '';

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
        if (editCategoria) editCategoria.value = equipamento.categoria_id || '';
        if (editStatus) editStatus.value = equipamento.status_id || '';
      } catch (e) {
        console.error('Erro ao carregar categorias ou status para edição:', e);
      }
    }

    // Render additional fields in the edit modal
    async function renderAdditionalFields(additionalFields, categoriaId) {
      const container = document.getElementById('edit-additional-fields-container');
      if (!container) return;
      container.innerHTML = '';

      if (additionalFields && Object.keys(additionalFields).length > 0) {
        try {
          // Fetch category additional fields metadata
          const res = await fetch(`/api/categorias/${categoriaId}/campos`);
          if (!res.ok) throw new Error('Erro ao carregar campos adicionais da categoria');
          const camposMeta = await res.json();

          // Create a map from nome_exibicao to display name
          const nomeCampoMap = {};
          camposMeta.forEach(campo => {
            nomeCampoMap[campo.id] = campo.nome_exibicao || campo.nome_campo;
          });

          Object.entries(additionalFields).forEach(([key, value]) => {
            const div = document.createElement('div');
            div.classList.add('form-group');

            const label = document.createElement('label');
            function formatFieldName(name) {
              if (!name) return '';
              let formatted = name;
              if (formatted.startsWith('campo_')) {
                formatted = formatted.replace('campo_', '');
              }
              formatted = formatted.replace(/_/g, ' ');
              formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
              return formatted;
            }
            label.textContent = nomeCampoMap[key] || formatFieldName(key);

            const input = document.createElement('input');
            input.type = 'text';
            input.name = `additional_${key}`;
            input.value = value;

            div.appendChild(label);
            div.appendChild(input);
            container.appendChild(div);
          });
        } catch (e) {
          console.error('Erro ao carregar campos adicionais para edição:', e);
        }
      }
    }

    await loadEditSelects();

    // Render additional fields
    renderAdditionalFields(equipamento.additionalFields, equipamento.categoria_id);

    // Show the edit modal
    const modal = document.getElementById('edit-equipment-modal');
    if (modal) {
      modal.classList.remove('hidden');

      // Add event listener for cancel button
      const cancelBtn = document.getElementById('cancel-edit');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          modal.classList.add('hidden');
        });
      }

      // Add event listener for form submission
      const editForm = document.getElementById('edit-equipment-form');
      if (editForm) {
        // Remove previous submit event listeners to avoid duplicates
        const newEditForm = editForm.cloneNode(true);
        editForm.parentNode.replaceChild(newEditForm, editForm);

        newEditForm.addEventListener('submit', async (e) => {
          e.preventDefault(); // Prevent page reload

          try {
            const id = document.getElementById('edit-equipment-id').value;
            const formData = new FormData();

            // Collect basic data
            formData.append('categoria_id', document.getElementById('edit-categoria').value);
            formData.append('nome', document.getElementById('edit-nome').value);
            formData.append('dono', document.getElementById('edit-dono').value);
            formData.append('setor', document.getElementById('edit-setor').value);
            formData.append('cargo', document.getElementById('edit-cargo').value);
            formData.append('descricao', document.getElementById('edit-descricao').value);
            formData.append('status_id', document.getElementById('edit-status').value);

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
            const response = await fetch(`/api/equipamentos/${id}`, {
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
              // Optionally reload or update data on the page
              window.location.reload();
            } else {
              alert(`Erro ao salvar: ${result.error || 'Erro desconhecido'}`);
            }
          } catch (error) {
            console.error('Erro ao salvar equipamento:', error);
            alert('Erro ao salvar equipamento. Tente novamente.');
          }
        });
      }
    } else {
      console.error('Modal de edição não encontrado');
    }
  } catch (err) {
    console.error('Erro ao carregar equipamento para edição:', err);
    alert('Erro ao carregar equipamento para edição.');
  }
}
