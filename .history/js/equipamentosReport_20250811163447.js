document.addEventListener('DOMContentLoaded', () => {
  // Equipment report table logic
  const equipamentosBody = document.getElementById('equipamentos-body');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const currentPageSpan = document.getElementById('current-page');
  const totalPagesSpan = document.getElementById('total-pages');
  const showingResultsSpan = document.getElementById('showing-results');
  const totalResultsSpan = document.getElementById('total-results');
  const columnFilters = document.querySelectorAll('.column-filter');

  let equipamentosData = [];
  let filteredData = [];
  let currentPage = 1;
  const rowsPerPage = 10;

  function renderTablePage(page) {
    if (!equipamentosBody) {
      console.error('Elemento equipamentos-body não encontrado');
      return;
    }
    
    equipamentosBody.innerHTML = '';

    if (filteredData.length === 0 && equipamentosData.length > 0) {
      filteredData = [...equipamentosData];
    }

    const pageData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    
    pageData.forEach(eq => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-column="nome">
          <a href="#" class="service-tag-link" data-id="${eq?.id || eq?.nome || ''}" style="color: #b9610f; text-decoration: none; cursor: pointer;">
            ${eq?.nome ?? ''}
          </a>
        </td>
        <td data-column="qrCode">
          ${eq?.qrCode ? `<img src="/uploads/${eq.qrCode}" alt="QR Code" style="width: 50px; height: 50px;" />` : ''}
        </td>
        <td data-column="dono">${eq?.dono ?? ''}</td>
        <td data-column="setor">${eq?.setor ?? ''}</td>
        <td data-column="cargo">${eq?.cargo ?? ''}</td>
        <td data-column="categoria">${eq?.categoria ?? ''}</td>
        <td data-column="status">${eq?.status_nome ?? ''}</td>
        <td class="actions-cell">
          <button class="btn-edit" data-id="${eq?.id || eq?.nome || ''}">✏️</button>
          <button class="btn-delete" data-id="${eq?.id || eq?.nome || ''}">🗑️</button>
        </td>
      `;
      equipamentosBody.appendChild(tr);
    });

    currentPageSpan.textContent = String(page);
    totalPagesSpan.textContent = String(Math.ceil(filteredData.length / rowsPerPage));
    showingResultsSpan.textContent = String(pageData.length);
    totalResultsSpan.textContent = String(filteredData.length);

    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= Math.ceil(filteredData.length / rowsPerPage);

      equipamentosBody.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', async () => {
          const id = button.getAttribute('data-id');
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

                  console.log('Campos meta:', camposMeta);

                  // Create a map from nome_exibicao to display name
                  const nomeCampoMap = {};
                  camposMeta.forEach(campo => {
                    console.log('Campo meta key:', campo.nome_campo, 'display:', campo.nome_exibicao);
                    // Use campo.nome_exibicao as display name
                    nomeCampoMap[campo.id] = campo.nome_exibicao || campo.nome_campo;
                  });

                  Object.entries(additionalFields).forEach(([key, value]) => {
                    console.log('Mapping key:', key, 'to label:', nomeCampoMap[key]);
                    const div = document.createElement('div');
                    div.classList.add('form-group');

                    const label = document.createElement('label');
                    // Use the mapped display name or fallback to key
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
            console.log('Categoria ID:', equipamento.categoria_id);
            console.log('Additional Fields:', equipamento.additionalFields);
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
                editForm.addEventListener('submit', async (e) => {
                  e.preventDefault(); // Prevenir reload da página
                  
                  try {
                    const id = document.getElementById('edit-equipment-id').value;
                    const formData = new FormData();
                    
                    // Coletar dados básicos
                    formData.append('categoria_id', document.getElementById('edit-categoria').value);
                    formData.append('nome', document.getElementById('edit-nome').value);
                    formData.append('dono', document.getElementById('edit-dono').value);
                    formData.append('setor', document.getElementById('edit-setor').value);
                    formData.append('cargo', document.getElementById('edit-cargo').value);
                    formData.append('descricao', document.getElementById('edit-descricao').value);
                    formData.append('status_id', document.getElementById('edit-status').value);

                    // Coletar campos adicionais
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

                    // Enviar requisição PUT
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
                      // Recarregar dados da tabela
                      fetch('/api/equipamentos')
                        .then(res => res.json())
                        .then(data => {
                          equipamentosData = data || [];
                          filteredData = [...equipamentosData];
                          renderTablePage(currentPage);
                        });
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
        });
      });

    equipamentosBody.querySelectorAll('.btn-delete').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-id');
        if (confirm('Tem certeza que deseja excluir este equipamento?')) {
          fetch(`/api/equipamentos/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          })
          .then(res => {
            if (!res.ok) throw new Error('Erro ao excluir equipamento');
            equipamentosData = equipamentosData.filter(eq => eq.id !== parseInt(id));
            applyFilters();
            alert('Equipamento excluído com sucesso.');
          })
          .catch(err => {
            console.error(err);
            alert('Erro ao excluir equipamento.');
          });
        }
      });
    });

    // Add click handlers for service tag links
    equipamentosBody.querySelectorAll('.service-tag-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const id = link.getAttribute('data-id');
        window.open(`detalhesEquipamento.html?id=${id}`, '_blank');
      });
    });
  }

  function applyFilters() {
    filteredData = equipamentosData.filter(eq => {
      return Array.from(columnFilters).every(input => {
        const column = input.getAttribute('data-column');
        const filterValue = (input.value || '').toLowerCase();
        if (!filterValue) return true;
        
        const cellValue = String(eq[column] || '').toLowerCase();
        return cellValue.includes(filterValue);
      });
    });
    currentPage = 1;
    renderTablePage(currentPage);
  }

  columnFilters.forEach(input => {
    input.addEventListener('input', () => {
      if (input.timeout) clearTimeout(input.timeout);
      input.timeout = setTimeout(() => {
        applyFilters();
      }, 300);
    });
  });

  fetch('/api/equipamentos')
      .then(async res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) throw new Error('Resposta não é JSON');
          return res.json();
      })
      .then(equipamentos => {
          console.log('Equipamentos fetched:', equipamentos); // Debug log
          equipamentosData = equipamentos || [];
          filteredData = [...equipamentosData];
          renderTablePage(currentPage);
      })
      .catch(err => console.error('Erro ao carregar equipamentos:', err));

  // History tab logic
  const historyBody = document.getElementById('history-body');
  const historySearchInput = document.getElementById('history-search');
  const historyUserInput = document.getElementById('history-user');
  const historyActionSelect = document.getElementById('history-action');
  const historyDateFromInput = document.getElementById('history-date-from');
  const historyDateToInput = document.getElementById('history-date-to');
  const historySearchBtn = document.getElementById('history-search-btn');
  const historyPrevBtn = document.getElementById('history-prev');
  const historyNextBtn = document.getElementById('history-next');
  const historyCurrentPageSpan = document.getElementById('history-current-page');
  const historyTotalPagesSpan = document.getElementById('history-total-pages');
  const historyShowingResultsSpan = document.getElementById('history-showing-results');
  const historyTotalResultsSpan = document.getElementById('history-total-results');

  let historyData = [];
  let historyCurrentPage = 1;
  const historyRowsPerPage = 10;

  function renderHistoryPage(page) {
    if (!historyBody) {
      console.error('Elemento history-body não encontrado');
      return;
    }

    historyBody.innerHTML = '';

    const pageData = historyData.slice((page - 1) * historyRowsPerPage, page * historyRowsPerPage);

    pageData.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td>${item.action}</td>
        <td>${item.user}</td>
        <td>${item.equipmentName || item.serviceTag || item.qrCode || ''}</td>
        <td>${item.changes || ''}</td>
      `;
      historyBody.appendChild(tr);
    });

    historyCurrentPageSpan.textContent = String(page);
    historyTotalPagesSpan.textContent = String(Math.ceil(historyData.length / historyRowsPerPage));
    historyShowingResultsSpan.textContent = String(pageData.length);
    historyTotalResultsSpan.textContent = String(historyData.length);

    historyPrevBtn.disabled = page <= 1;
    historyNextBtn.disabled = page >= Math.ceil(historyData.length / historyRowsPerPage);
  }

  async function fetchHistory(filters = {}) {
    const params = new URLSearchParams();

    if (filters.textFilter) params.append('textFilter', filters.textFilter);
    if (filters.userFilter) params.append('userFilter', filters.userFilter);
    if (filters.actionFilter) params.append('actionFilter', filters.actionFilter);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    try {
      const res = await fetch('/historico?' + params.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      historyData = data || [];
      historyCurrentPage = 1;
      renderHistoryPage(historyCurrentPage);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  }

  function applyHistoryFilters() {
    const filters = {
      textFilter: historySearchInput.value.trim(),
      userFilter: historyUserInput.value.trim(),
      actionFilter: historyActionSelect.value,
      startDate: historyDateFromInput.value,
      endDate: historyDateToInput.value
    };
    fetchHistory(filters);
  }

  historySearchBtn.addEventListener('click', () => {
    applyHistoryFilters();
  });

  historyPrevBtn.addEventListener('click', () => {
    if (historyCurrentPage > 1) {
      historyCurrentPage--;
      renderHistoryPage(historyCurrentPage);
    }
  });

  historyNextBtn.addEventListener('click', () => {
    if (historyCurrentPage < Math.ceil(historyData.length / historyRowsPerPage)) {
      historyCurrentPage++;
      renderHistoryPage(historyCurrentPage);
    }
  });

  // Initial load of history without filters
  fetchHistory();
});
