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
  let cargosMap = new Map();

  async function loadMappings() {
    try {
      const [catRes, statusRes, cargoRes] = await Promise.all([
        fetch('/api/categorias'),
        fetch('/api/status'),
        fetch('/api/cargos')
      ]);
      if (!catRes.ok || !statusRes.ok || !cargoRes.ok) throw new Error('Erro ao carregar mapeamentos');
      const [categories, statuses, cargos] = await Promise.all([catRes.json(), statusRes.json(), cargoRes.json()]);
      categories.forEach(cat => categoriesMap.set(cat.id, cat.nome));
      statuses.forEach(st => statusesMap.set(st.id, st.nome));
      cargos.forEach(cg => cargosMap.set(cg.id, cg.nome));
    } catch (err) {
      console.error('Erro ao carregar mapeamentos:', err);
    }
  }

  function mapValue(key, value) {
    if (key === 'categoria_id') return categoriesMap.get(Number(value)) || value;
    if (key === 'status_id') return statusesMap.get(Number(value)) || value;
    if (key === 'cargo') return cargosMap.get(Number(value)) || value;
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
        console.log('Rendering history item:', item);
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

        let changesText = '';
        try {
          const changesObj = JSON.parse(item.changed_fields);
          changesText = Object.entries(changesObj).map(([key, value]) => {
            const label = keyLabels[key] || key;
            return `<strong>${label}</strong>: ${formatValue(value, key)}`;
          }).join('<br>');
        } catch {
          changesText = item.changed_fields || '';
        }

        // Create toggle button and hidden div for changes
        const changesId = `changes-${item.id}`;
        const toggleButton = `<button class="toggle-changes-btn" data-target="${changesId}">Mostrar Alterações</button>`;
        const changesDiv = `<div id="${changesId}" class="changes-details" style="display:none; margin-top: 5px;">${changesText}</div>`;

        // Create modal for full snapshot
        const modalId = `modal-${item.id}`;
        const modalHtml = `
          <div id="${modalId}" class="modal" style="display:none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.4);">
            <div class="modal-content" style="background-color: #fefefe; margin: 10% auto; padding: 20px; border: 1px solid #888; width: 80%; max-height: 70vh; overflow-y: auto;">
              <span class="close" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
              <h2>Detalhes do Equipamento (Histórico)</h2>
              <div class="modal-body"></div>
            </div>
          </div>
        `;

        tr.innerHTML = `
          <td>${new Date(item.timestamp).toLocaleString()}</td>
          <td>${item.action}</td>
          <td>${item.admin_name || ''}</td>
          <td>
            <span class="equipment-name" style="color: #b9610f; text-decoration: underline; cursor: pointer;" data-modal-id="${modalId}">
              ${item.equipment_name || 'N/A'}
            </span>
          </td>
          <td>
            ${toggleButton}
            ${changesDiv}
          </td>
        `;

        historyTableBody.appendChild(tr);

        // Append modal to body
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        // Populate modal body with full snapshot from changed_fields
        const modal = document.getElementById(modalId);
        const modalBody = modal.querySelector('.modal-body');
        try {
          const snapshot = item.full_snapshot;
          function renderSnapshot(obj) {
            if (typeof obj === 'object' && obj !== null) {
              return '<ul>' + Object.entries(obj).map(([k, v]) => {
                return `<li><strong>${k}</strong>: ${renderSnapshot(v)}</li>`;
              }).join('') + '</ul>';
            }
            return String(obj);
          }
          modalBody.innerHTML = renderSnapshot(snapshot);
        } catch {
          modalBody.innerHTML = 'Detalhes indisponíveis.';
        }

        // Event listeners for modal open/close
        const equipmentNameSpan = tr.querySelector('.equipment-name');
        const closeBtn = modal.querySelector('.close');

        equipmentNameSpan.addEventListener('click', () => {
          modal.style.display = 'block';
        });

        closeBtn.addEventListener('click', () => {
          modal.style.display = 'none';
        });

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

    // Add event listeners for toggle buttons
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
      console.log('Fetching history with filters:', filters);
      const res = await fetch('/api/historico?' + params.toString(), {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log('Fetch response:', res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log('History data received:', data);
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

  // Initial load: load mappings then fetch history
  loadMappings().then(() => {
    fetchHistory();
  });
});
