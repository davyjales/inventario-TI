import { abrirModalEditarEquipamento } from './editEquipmentModal.js';

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

  // Check if required elements exist before proceeding
  if (!equipamentosBody || !prevPageBtn || !nextPageBtn || !currentPageSpan || 
      !totalPagesSpan || !showingResultsSpan || !totalResultsSpan) {
    console.warn('Alguns elementos necessários não foram encontrados. O script será encerrado.');
    return;
  }

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
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-id');
        abrirModalEditarEquipamento(id);
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
=======
  fetch('/api/equipamentos', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  })
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
  .catch(err => {
    console.error('Erro ao carregar equipamentos:', err);
    alert('Erro ao carregar equipamentos. Verifique sua conexão ou faça login novamente.');
  });

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
      const res = await fetch('/api/historico?' + params.toString());
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
