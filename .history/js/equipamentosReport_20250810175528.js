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
    if (!equipamentosBody) return;
    equipamentosBody.innerHTML = '';

    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageData = filteredData.slice(start, end);

      pageData.forEach(eq => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td data-column="nome">${eq?.nome ?? ''}</td>
          <td data-column="qrCode">${eq?.qrCode ?? ''}</td>
          <td data-column="dono">${eq?.dono ?? ''}</td>
          <td data-column="setor">${eq?.setor ?? ''}</td>
          <td data-column="cargo">${eq?.cargo ?? ''}</td>
          <td data-column="categoria">${eq?.categoria ?? ''}</td>
          <td data-column="status">${eq?.status ?? ''}</td>
          <td>
            <button class="btn-edit" data-id="${eq?.id || eq?.nome || ''}" title="Editar">✏️</button>
            <button class="btn-delete" data-id="${eq?.id || eq?.nome || ''}" title="Excluir">🗑️</button>
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
  }

  function applyFilters() {
    filteredData = equipamentosData.filter(eq => {
      return Array.from(columnFilters).every(input => {
        const column = input.getAttribute('data-column');
        const filterValue = (input.value || '').toLowerCase();
        if (!filterValue) return true;
        const cellValue = (eq[column] ?? '').toString().toLowerCase();
        return cellValue.includes(filterValue);
      });
    });
    currentPage = 1;
    renderTablePage(currentPage);
  }

  columnFilters.forEach(input => {
    input.addEventListener('input', () => {
      applyFilters();
    });
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

  // Fetch equipment data and initialize table
  fetch('/api/equipamentos')
    .then(async res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Resposta não é JSON');
      return res.json();
    })
    .then(equipamentos => {
      equipamentosData = equipamentos || [];
      applyFilters();
    })
    .catch(err => console.error('Erro ao carregar equipamentos:', err));
});
