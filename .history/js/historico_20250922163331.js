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
      const [catRes, statusRes, camposRes] = await Promise.all([
        fetch('/api/categorias'),
        fetch('/api/status'),
        fetch('/api/categorias/campos-adicionais/all')
      ]);
      if (!catRes.ok || !statusRes.ok || !camposRes.ok) throw new Error('Erro ao carregar mapeamentos');
      const [categories, statuses, campos] = await Promise.all([
        catRes.json(), statusRes.json(), camposRes.json()
      ]);
      categories.forEach(cat => categoriesMap.set(cat.id, cat.nome));
      statuses.forEach(st => statusesMap.set(st.id, st.nome));

      // Processar campos adicionais corretamente
      if (Array.isArray(campos)) {
        campos.forEach(campo => {
          if (campo.nome_exibicao) {
            additionalFieldsMap.set(Number(campo.id), campo.nome_exibicao);
          }
        });
      }
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
    // se key for número ou string numérica (ex: "16"), tentar mapear
    if (!isNaN(Number(key))) {
      return additionalFieldsMap.get(Number(key)) || value;
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

    const actionNameMap = {
      consulta: 'Inventario'
    };
    console.log('Action original:', item.action);
    const displayAction = actionNameMap[item.action.toLowerCase()] || item.action;

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

    let changesText = '';
    if (item.action === 'update') {
      try {
        const changesObj = JSON.parse(item.changed_fields || '{}');

        // Filtra apenas campos que realmente mudaram
        const realChanges = Object.entries(changesObj)
          .filter(([key, value]) => {
            if (!value || typeof value !== 'object') return false;
            if (!value.de || !value.para) return false;

            // Compara os valores para garantir que são diferentes
            const oldVal = String(value.de || '').trim();
            const newVal = String(value.para || '').trim();

            return oldVal !== newVal;
          });

        if (realChanges.length > 0) {
          changesText = realChanges.map(([key, value]) => {
            if (key === 'additionalFields') {
              // Trata campos adicionais
              const oldValues = value.de || {};
              const newValues = value.para || {};

              const allCampoIds = new Set([
                ...Object.keys(oldValues),
                ...Object.keys(newValues)
              ]);

              return [...allCampoIds].map(campoId => {
                const nomeCampo = additionalFieldsMap.get(Number(campoId)) || `Campo ${campoId}`;
                const oldVal = oldValues[campoId] || 'Não informado';
                const newVal = newValues[campoId] || 'Não informado';

                return `<div><strong>${nomeCampo}</strong>: de <em>${oldVal}</em> para <em>${newVal}</em></div>`;
              }).join('');
            } else {
              // Trata campos normais
              const label = value.campo || key;
              const oldVal = value.de || 'Não informado';
              const newVal = value.para || 'Não informado';

              return `<div><strong>${label}</strong>: de <em>${oldVal}</em> para <em>${newVal}</em></div>`;
            }
          }).join('');
        } else {
          changesText = '<em>Nenhuma alteração detectada</em>';
        }
      } catch (err) {
        console.error("❌ Erro ao parsear changed_fields:", err);
        changesText = '<em>Erro ao carregar alterações</em>';
      }
    } else {
      changesText = '<em>Ação: ' + item.action + '</em>';
    }


    const changesId = `changes-${item.id}`;
    const toggleButton = (item.action === 'update') ? `<button class="toggle-changes-btn" data-target="${changesId}">Mostrar Alterações</button>` : '';
    const changesDiv = `<div id="${changesId}" class="changes-details" style="display:none; margin-top: 5px;">${changesText}</div>`;

    const modalId = `modal-${item.id}`;
    const modalHtml = `
      <div id="${modalId}" class="modal" style="display:none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6);">
        <div class="modal-content" style="background-color: #fff; margin: 5% auto; padding: 30px; border-radius: 8px; width: 80%; max-height: 85vh; overflow-y: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333;">
          <span class="close" style="color: #555; float: right; font-size: 28px; font-weight: bold; cursor: pointer; transition: color 0.3s;">&times;</span>
          <h2 style="margin-top: 0; font-weight: 700; font-size: 24px; border-bottom: 2px solid #b9610f; padding-bottom: 10px; color: #b9610f;">Detalhes do Equipamento (Histórico)</h2>
          <div class="modal-body" style="font-size: 16px; line-height: 1.6;">
            <div style="margin-bottom: 20px;">
              <h3 style="color: #b9610f; margin-bottom: 10px;">Informações Principais</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Nome:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.equipment_name || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Usuário:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.dono || 'Não informado'}</td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Setor:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.full_snapshot?.setor || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Categoria:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.full_snapshot?.categoria_nome || 'Não informado'}</td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Status:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.full_snapshot?.status_nome || 'Não informado'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Cargo:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.full_snapshot?.cargo || 'Não informado'}</td>
                </tr>
                <tr style="background-color: #f8f9fa;">
                  <td style="padding: 8px; font-weight: bold; border: 1px solid #ddd;">Descrição:</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${item.full_snapshot?.descricao || 'Não informado'}</td>
                </tr>
              </table>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="color: #b9610f; margin-bottom: 10px;">Campos Adicionais</h3>
              <div id="additional-fields-${item.id}" style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid #e9ecef;">
                <em>Carregando campos adicionais...</em>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    tr.innerHTML = `
      <td>${new Date(item.timestamp).toLocaleString()}</td>
      <td>${displayAction}</td>
      <td>${item.admin_name || ''}</td>
      <td>${item.dono || ''}</td>
      <td>
        <span class="equipment-name" style="color: #b9610f; text-decoration: underline; cursor: pointer;" data-modal-id="modal-${item.id}">
          ${typeof item.equipment_name === 'string' ? item.equipment_name : 'Não informado'}
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

      // Merge current_additionalFields into full_snapshot.additionalFields for better display
      if (item.current_additionalFields && snapshot) {
        snapshot.additionalFields = {
          ...snapshot.additionalFields,
          ...item.current_additionalFields
        };
      }

      // Função para renderizar o snapshot completo
      function renderSnapshot(obj, parentKey = '') {
        if (typeof obj === 'object' && obj !== null) {
          // Para campos adicionais, renderizar individualmente
          if (parentKey === 'additionalFields') {
            return Object.entries(obj).map(([campoId, campoData]) => {
              // Se campoId for numérico (campo_14, 14, etc), tentar mapear
              let numericId = Number(campoId);
              if (isNaN(numericId)) {
                const m = String(campoId).match(/(\d+)/);
                numericId = m ? Number(m[1]) : null;
              }

              // Nome do campo: usar mapping das categorias se disponível
              const nomeCampo = (numericId !== null && !isNaN(numericId) ? additionalFieldsMap.get(Number(numericId)) : null)
                                || campoId;

              // Valor: se campoData for objeto com 'valor', usar isso, senão usar campoData diretamente
              const valor = (typeof campoData === 'object' && campoData !== null && 'valor' in campoData)
                            ? campoData.valor
                            : campoData;

              // Só renderizar se nomeCampo não for um campo técnico (campo_14, etc)
              if (nomeCampo && !nomeCampo.startsWith('campo_') && nomeCampo !== campoId) {
                return `<li><strong>${nomeCampo}</strong>: ${valor || 'Não informado'}</li>`;
              }

              return '';
            }).filter(item => item !== '').join('');
          }

          return '<ul>' + Object.entries(obj).map(([k, v]) => {
            if (v === null || v === undefined || v === '') return '';
            if (['categoria_id', 'status_id', 'id'].includes(k)) return '';

            let displayKey = k;
            let displayValue = v;

            if (k === 'categoria_nome') displayKey = 'Categoria';
            else if (k === 'status_nome') displayKey = 'Status';
            else if (k === 'additionalFields') displayKey = 'Campos Adicionais';
            else if (k === 'qrcode' || k === 'qrCode') {
              displayKey = 'QRCode';
              displayValue = String(v).replace('.png', '');
            }
            else if (k === 'cargo') displayKey = 'Cargo';
            else if (k === 'nome') displayKey = 'Nome';
            else if (k === 'dono') displayKey = 'Usuário';
            else if (k === 'setor') displayKey = 'Setor';
            else if (k === 'descricao') displayKey = 'Descrição';

            return `<li><strong>${displayKey}</strong>: ${renderSnapshot(displayValue, displayKey)}</li>`;
          }).join('') + '</ul>';
        }
        return String(obj || 'Não informado');
      }

      // Renderizar o snapshot completo
      let htmlContent = '';

      if (snapshot && Object.keys(snapshot).length > 0) {
        htmlContent = renderSnapshot(snapshot);

        // Se não há conteúdo significativo, mostrar mensagem
        if (!htmlContent || htmlContent.trim() === '<ul></ul>') {
          htmlContent = '<em>Snapshot não disponível para este registro.</em>';
        }
      } else {
        htmlContent = '<em>Snapshot não disponível para este registro.</em>';
      }

      modalBody.innerHTML = htmlContent;

      // Debug: log do snapshot para verificar se está chegando corretamente
      console.log('Snapshot do modal:', snapshot);
    } catch (error) {
      console.error('Erro ao renderizar modal:', error);
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
