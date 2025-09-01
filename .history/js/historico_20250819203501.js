document.addEventListener('DOMContentLoaded', () => {
  const historyTableBody = document.getElementById('history-table-body');
  const filterEquipmentName = document.getElementById('filter-equipment-name');
  const filterEquipmentUser = document.getElementById('filter-equipment-user');
  const filterAdminUser = document.getElementById('filter-admin-user');
  const btnFilter = document.getElementById('btn-filter');
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');
  const currentPageSpan = document.getElementById('current-page');
  const totalPagesSpan = document.getElementById('total-pages');
  const showingResultsSpan = document.getElementById('showing-results');
  const totalResultsSpan = document.getElementById('total-results');

  let historyData = [];
  let filteredData = [];
  let currentPage = 1;
  const rowsPerPage = 10;

  let categoriesMap = new Map();
  let statusesMap = new Map();
  let additionalFieldsMap = new Map();

  async function loadMappings() {
    try {
      const [catRes, statusRes, cargoRes, camposRes] = await Promise.all([
        fetch('/api/categorias'),
        fetch('/api/status'),
        fetch('/api/campos-adicionais')
      ]);
      if (!catRes.ok || !statusRes.ok || !cargoRes.ok || !camposRes.ok) throw new Error('Erro ao carregar mapeamentos');
      const [categories, statuses, campos] = await Promise.all([
        catRes.json(), statusRes.json(), cargoRes.json(), camposRes.json()
      ]);
      categories.forEach(cat => categoriesMap.set(cat.id, cat.nome));
      statuses.forEach(st => statusesMap.set(st.id, st.nome));
      campos.forEach(c => additionalFieldsMap.set(c.id, c.nome_exibicao));
    } catch (err) {
      console.error('Erro ao carregar mapeamentos:', err);
    }
  }

  function mapValue(key, value) {
    if (key === 'categoria_id') return categoriesMap.get(Number(value)) || value;
    if (key === 'status_id') return statusesMap.get(Number(value)) || value;
    if (key.startsWith('campo_')) {
      const campoId = key.split('_')[1];
      return additionalFieldsMap.get(Number(campoId)) || key;
    }
    return value;
  }

  function renderTablePage(page) {
    if (!historyTableBody) {
      console.error('Elemento history-table-body não encontrado');
      return;
    }

    historyTableBody.innerHTML = '';

    if (filteredData.length === 0 && historyData.length > 0) {
      filteredData = [...historyData];
    }

    const pageData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    pageData.forEach(item => {
      const tr = document.createElement('tr');

      function formatValue(value, parentKey = '') {
        if (typeof value === 'object' && value !== null) {
          return '<ul>' + Object.entries(value).map(([k, v]) => {
            if (k === 'de' || k === 'para') {
              return `<li><strong>${k}</strong>: ${mapValue(parentKey, v)}</li>`;
            }
            return `<li><strong>${k}</strong>: ${formatValue(v, k)}</li>`;
          }).join('') + '</ul>';
        }
        return String(mapValue(parentKey, value));
      }

      const keyLabels = {
        status_id: 'Status',
        cargo: 'Cargo'
      };

      let changesText = item.changed_fields || '';
      if (item.action === 'update') {
        try {
          const changesObj = JSON.parse(changesText);

          // ignora campos técnicos
          const ignoreKeys = ['id', 'categoria_id', 'status_id', 'status_nome'];

          changesText = Object.entries(changesObj)
            .filter(([key]) => !ignoreKeys.includes(key))
            .map(([key, value]) => {
              let label;
              if (key === 'additionalFields') {
                // Trata campos adicionais individualmente
                return Object.entries(value).map(([campoId, change]) => {
                  const nomeCampo = additionalFieldsMap.get(Number(campoId)) || `Campo ${campoId}`;
                  return `<div>👉 <strong>${nomeCampo}</strong>: de <em>${change.de ?? ''}</em> para <em>${change.para ?? ''}</em></div>`;
                }).join('');
              } else if (key.startsWith('campo_')) {
                const campoId = key.split('_')[1];
                label = additionalFieldsMap.get(Number(campoId)) || `Campo ${campoId}`;
                return `<strong>${label}</strong>: ${formatValue(value, key)}`;
              } else {
                label = keyLabels[key] || key;
                return `<strong>${label}</strong>: ${formatValue(value, key)}`;
              }
            })
            .join('<br>');
        } catch {
          changesText = item.changed_fields || '';
        }
      }

      const changesId = `changes-${item.id}`;
      const toggleButton = (item.action === 'update') ? `<button class="toggle-changes-btn" data-target="${changesId}">Mostrar Alterações</button>` : '';
      const changesDiv = `<div id="${changesId}" class="changes-details" style="display:none; margin-top: 5px;">${changesText}</div>`;

      const modalId = `modal-${item.id}`;
      const modalHtml = `
        <div id="${modalId}" class="modal" style="display:none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6);">
          <div class="modal-content" style="background-color: #fff; margin: 5% auto; padding: 30px; border-radius: 8px; width: 60%; max-height: 75vh; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
            <span class="close" style="color: #555; float: right; font-size: 28px; font-weight: bold; cursor: pointer; transition: color 0.3s;">&times;</span>
            <h2 style="margin-top: 0; font-weight: 700; font-size: 24px; border-bottom: 2px solid #b9610f; padding-bottom: 10px; color: #b9610f;">Detalhes do Equipamento (Histórico)</h2>
            <div class="modal-body" style="font-size: 16px; line-height: 1.5;"></div>
          </div>
        </div>
      `;

      tr.innerHTML = `
        <td>${new Date(item.timestamp).toLocaleString()}</td>
        <td>${item.action}</td>
        <td>${item.admin_name || ''}</td>
        <td>${item.dono || ''}</td>
        <td>
          <span class="equipment-name" style="color: #b9610f; text-decoration: underline; cursor: pointer;" data-modal-id="modal-${item.id}">
            ${typeof item.equipment_name === 'string' ? item.equipment_name : 'N/A'}
          </span>
        </td>
        <td>
          ${toggleButton}
          ${changesDiv}
        </td>
      `;

      historyTableBody.appendChild(tr);

      const existingModal = document.getElementById(modalId);
      if (existingModal) {
        existingModal.remove();
      }

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modal = document.getElementById(modalId);
      if (!modal) return;
      const modalBody = modal.querySelector('.modal-body');
      try {
        const snapshot = item.full_snapshot;
        function renderSnapshot(obj, parentKey = '') {
          if (typeof obj === 'object' && obj !== null) {
            if (parentKey === 'Campos Adicionais') {
              return Object.entries(obj).map(([campoId, v]) => {
                const nomeCampo = additionalFieldsMap.get(Number(campoId)) || `Campo ${campoId}`;
                return `<li><strong>${nomeCampo}</strong>: ${v}</li>`;
              }).join('');
            }
            return '<ul>' + Object.entries(obj).map(([k, v]) => {
              if (v === null) return '';
              if (['categoria_id', 'status_id', 'id'].includes(k)) return '';
              let displayKey = k;
              if (k === 'categoria_nome') displayKey = 'Categoria';
              else if (k === 'status_nome') displayKey = 'Status';
              else if (k === 'additionalFields') displayKey = 'Campos Adicionais';
              return `<li><strong>${displayKey}</strong>: ${renderSnapshot(v, displayKey)}</li>`;
            }).join('') + '</ul>';
          }
          return String(obj);
        }
        modalBody.innerHTML = renderSnapshot(snapshot);
      } catch {
        modalBody.innerHTML = 'Detalhes indisponíveis.';
      }

      const equipmentNameSpan = tr.querySelector('.equipment-name');
      const closeBtn = modal.querySelector('.close');

      if (equipmentNameSpan) {
        equipmentNameSpan.addEventListener('click', () => {
          modal.style.display = 'block';
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }

      window.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.style.display = 'none';
        }
      });
    });

    currentPageSpan.textContent = String(page);
    totalPagesSpan.textContent = String(Math.ceil(filteredData.length / rowsPerPage));
    showingResultsSpan.textContent = String(pageData.length);
    totalResultsSpan.textContent = String(filteredData.length);

    prevPageBtn.disabled = page <= 1;
    nextPageBtn.disabled = page >= Math.ceil(filteredData.length / rowsPerPage);

    document.querySelectorAll('.toggle-changes-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const targetDiv = document.getElementById(targetId);
        if (targetDiv.style.display === 'none') {
          targetDiv.style.display = 'block';
          btn.textContent = 'Ocultar Alterações';
        } else {
          targetDiv.style.display = 'none';
          btn.textContent = 'Mostrar Alterações';
        }
      });
    });
  }

  async function fetchHistory(filters = {}) {
    const params = new URLSearchParams();

    if (filters.equipmentNameFilter) params.append('equipmentNameFilter', filters.equipmentNameFilter);
    if (filters.equipmentUserFilter) params.append('equipmentUserFilter', filters.equipmentUserFilter);
    if (filters.adminUserFilter) params.append('adminUserFilter', filters.adminUserFilter);
    if (filters.actionFilter) params.append('actionFilter', filters.actionFilter);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    try {
      const res = await fetch('/api/historico?' + params.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      historyData = data || [];
      filteredData = [...historyData];
      currentPage = 1;
      renderTablePage(currentPage);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    }
  }

  function applyFilters() {
    const filters = {
      equipmentNameFilter: filterEquipmentName.value.trim(),
      equipmentUserFilter: filterEquipmentUser.value.trim(),
      adminUserFilter: filterAdminUser.value.trim()
    };
    fetchHistory(filters);
  }

  btnFilter.addEventListener('click', () => {
    applyFilters();
  });

  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderTablePage(currentPage);
    }
  });

  nextPageBtn.addEventListener('click', () => {
    if (currentPage < Math.ceil(filteredData.length / rowsPerPage)) {
      currentPage++;
      renderTablePage(currentPage);
    }
  });

  loadMappings().then(() => {
    fetchHistory();
  });
});
