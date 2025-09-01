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
    
    console.log('Renderizando tabela...'); // Log para depuração
    
    equipamentosBody.innerHTML = '';

    // Garante que filteredData sempre tenha valores
    if (filteredData.length === 0 && equipamentosData.length > 0) {
      filteredData = [...equipamentosData];
    }

    const pageData = filteredData.slice((page - 1) * rowsPerPage, page * rowsPerPage);
    
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

    // Attach event listeners for edit and delete buttons
    equipamentosBody.querySelectorAll('.btn-edit').forEach(button => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-id');
        alert(`Editar equipamento com ID: ${id}`);
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

// Na chamada inicial, garantir que filteredData é preenchida
fetch('/api/equipamentos')
    .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        if (!ct.includes('application/json')) throw new Error('Resposta não é JSON');
        return res.json();
    })
    .then(equipamentos => {
        equipamentosData = equipamentos || [];
        filteredData = [...equipamentosData]; // Inicializa filteredData com todos os dados
        renderTablePage(currentPage); // Renderiza imediatamente
    })
    .catch(err => console.error('Erro ao carregar equipamentos:', err));
});
