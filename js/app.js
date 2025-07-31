document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/';
    let equipamentos = [], categorias = [];

    // Corrigido: obter admin e inventariante a partir do token JWT
    let isAdmin = false;
    let isInventariante = false;
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            isAdmin = payload.admin;
            isInventariante = payload.inventariante;
        } catch (err) {
            console.warn('Token inválido:', err);
        }
    }

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');

    
    function showSection(id) {
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === id) section.classList.add('active');
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${id}`) {
                link.classList.add('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const id = link.getAttribute('href').substring(1);
            showSection(id);
        });
    });

    const btnCadastrar = document.getElementById('btn-cadastrar');
    const btnConsultar = document.getElementById('btn-consultar');
    if (btnCadastrar) btnCadastrar.addEventListener('click', () => showSection('cadastro-equipamentos'));
    if (btnConsultar) btnConsultar.addEventListener('click', () => showSection('consulta'));

    const hash = window.location.hash;
    if (hash) showSection(hash.substring(1));
    window.addEventListener('hashchange', () => {
        showSection(window.location.hash.substring(1));
    });

    const searchInput = document.getElementById('search-equipment');
    const filterModeSelect = document.getElementById('filter-mode');
    const equipmentList = document.getElementById('equipment-list');

    const formCadastro = document.getElementById('form-cadastro');

    // Add form submission handler for equipment registration
    if (formCadastro) {
        formCadastro.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(formCadastro);

            try {
                const res = await fetch(`${API_URL}equipamentos`, {
                    method: 'POST',
                    body: formData
                });

                if (res.ok) {
                    alert('Equipamento cadastrado com sucesso!');
                    formCadastro.reset();
                    showSection('consulta');
                    fetchEquipamentos();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Erro ao cadastrar equipamento.');
                }
            } catch (err) {
                alert('Erro de conexão ao cadastrar equipamento.');
            }
        });
    }
    const selectCategoria = document.getElementById('categoria');
    const categoriaLista = document.getElementById('categoria-lista');

    const qrcodeRadios = document.getElementsByName('existeQRCode');
    const qrCodeContainer = document.getElementById('qrcode-container');
    const qrCodeInput = document.getElementById('qrCode');

    qrcodeRadios?.forEach(radio => {
        radio.addEventListener('change', () => {
            const isSim = radio.value === 'sim';
            qrCodeContainer.style.display = isSim ? 'block' : 'none';
            if (!isSim) qrCodeInput.value = '';
            qrCodeInput.required = isSim;
        });
    });

    const radios = document.getElementsByName('existeTermo');
    const termoInputContainer = document.getElementById('upload-termo-container');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            termoInputContainer.style.display = radio.value === 'sim' ? 'block' : 'none';
        });
    });

    async function fetchCategorias() {
        try {
            const res = await fetch(`${API_URL}categorias`);
            categorias = await res.json();
            renderCategorias();
        } catch {
            alert('Erro ao carregar categorias.');
        }
    }

    async function fetchEquipamentos() {
        try {
            const res = await fetch(`${API_URL}equipamentos`);
            equipamentos = await res.json();
            renderEquipamentosTable();
        } catch {
            alert('Erro ao carregar equipamentos.');
        }
    }

    function renderCategorias() {
        if (!selectCategoria || !categoriaLista) return;

        selectCategoria.innerHTML = '';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });

        categoriaLista.innerHTML = '';
        categorias.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat;
            categoriaLista.appendChild(li);
        });
    }

    // Initial fetch calls
    fetchCategorias();
    fetchEquipamentos();

    function renderEquipamentosTable() {
        const tbody = document.getElementById('equipamentos-body');
        if (!tbody) return;

        // Get filter values from inputs
        const filters = {};
        document.querySelectorAll('.column-filter').forEach(input => {
            filters[input.dataset.column] = input.value.trim().toLowerCase();
        });

        tbody.innerHTML = '';

        const filtered = equipamentos.filter(eq => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value) return true;
                const fieldValue = eq[key] ? eq[key].toString().toLowerCase() : '';
                return fieldValue.includes(value);
            });
        });

        if (filtered.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 7;
            td.textContent = 'Nenhum equipamento encontrado.';
            td.style.textAlign = 'center';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        filtered.forEach(eq => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="service-tag-link" data-id="${eq.id}">${eq.nome || ''}</td>
                <td>${eq.qrCode || ''}</td>
                <td>${eq.dono || ''}</td>
                <td>${eq.setor || ''}</td>
                <td>${eq.hostname || ''}</td>
                <td>${eq.categoria || ''}</td>
                <td>${eq.status || ''}</td>
                <td>
                  <span class="action-icon edit-icon" data-id="${eq.id}" title="Editar">✏️</span>
                  <span class="action-icon delete-icon" data-id="${eq.id}" title="Excluir">🗑️</span>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add click event listener to service tag cells for redirection
        document.querySelectorAll('.service-tag-link').forEach(cell => {
            cell.addEventListener('click', () => {
                const id = cell.dataset.id;
                if (id) {
                    window.location.href = `detalhes.html?id=${id}`;
                }
            });
        });

        // Add click event listener to edit icons for redirection to edit page
        document.querySelectorAll('.edit-icon').forEach(icon => {
            icon.addEventListener('click', () => {
                const id = icon.dataset.id;
                if (id) {
                    window.location.href = `editar.html?id=${id}`;
                }
            });
        });

        // Add click event listener to delete icons for deleting equipment
        document.querySelectorAll('.delete-icon').forEach(icon => {
            icon.addEventListener('click', async () => {
                const id = icon.dataset.id;
                if (!id) return;
                if (!confirm('Deseja realmente excluir este equipamento?')) return;

                try {
                    const res = await fetch(`http://localhost:3000/equipamentos/${id}`, {
                        method: 'DELETE'
                    });
                    if (res.ok) {
                        alert('Equipamento excluído.');
                        fetchEquipamentos();
                    } else {
                        alert('Erro ao excluir equipamento.');
                    }
                } catch (err) {
                    alert('Erro de conexão ao excluir equipamento.');
                }
            });
        });
    }

    if (searchInput) {
        searchInput.style.display = 'none'; // Hide global search input as we have column filters now
    }

    if (filterModeSelect) {
        filterModeSelect.style.display = 'none'; // Hide global filter mode select as we have column filters now
    }

    // Add event listeners to column filter inputs
    document.querySelectorAll('.column-filter').forEach(input => {
        input.addEventListener('input', () => {
            renderEquipamentosTable();
        });
    });

});
