document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://localhost:3000/';
    let equipamentos = [], categorias = [];

    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');

    function showSection(id) {
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === id) {
                section.classList.add('active');
            }
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
    if (btnCadastrar) btnCadastrar.addEventListener('click', () => showSection('cadastro'));
    if (btnConsultar) btnConsultar.addEventListener('click', () => showSection('consulta'));

    const hash = window.location.hash;
    if (hash) {
        const sectionId = hash.substring(1);
        showSection(sectionId);
    }

    window.addEventListener('hashchange', () => {
        const id = window.location.hash.substring(1);
        showSection(id);
    });

    const searchInput = document.getElementById('search-equipment');
    const filterModeSelect = document.getElementById('filter-mode');
    const equipmentList = document.getElementById('equipment-list');

    const formCadastro = document.getElementById('form-cadastro');
    const selectCategoria = document.getElementById('categoria');
    const categoriaLista = document.getElementById('categoria-lista');
    const formCategoria = document.getElementById('form-categoria');
    const inputNovaCategoriaLista = document.getElementById('input-nova-categoria');

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
            renderEquipamentosList();
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

    function renderEquipamentosList(filter = '') {
        if (!equipmentList || !filterModeSelect) return;

        equipmentList.innerHTML = '';
        const filterMode = filterModeSelect.value;

        const filtered = equipamentos.filter(eq => {
            const fieldValue = eq[filterMode] ? eq[filterMode].toLowerCase() : '';
            return fieldValue.includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            equipmentList.textContent = 'Nenhum equipamento encontrado.';
            return;
        }

        filtered.forEach(eq => {
            const valorExibido = eq[filterMode] || '—';
            const div = document.createElement('div');
            div.className = 'equipment-item';
            div.innerHTML = `<h3>${valorExibido}</h3><p>${eq.categoria}</p>`;
            div.addEventListener('click', () => {
                window.location.href = `detalhes.html?id=${eq.id}`;
            });
            equipmentList.appendChild(div);
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => renderEquipamentosList(searchInput.value));
    }

    if (filterModeSelect) {
        filterModeSelect.addEventListener('change', () => {
            renderEquipamentosList(searchInput?.value || '');
        });

        // Garante que "categoria" seja uma opção
        if (![...filterModeSelect.options].some(opt => opt.value === 'categoria')) {
            const option = document.createElement('option');
            option.value = 'categoria';
            option.textContent = 'Categoria';
            filterModeSelect.appendChild(option);
        }
    }

    if (formCadastro) {
        formCadastro.addEventListener('submit', async e => {
            e.preventDefault();

            const getInputValue = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            const categoria = selectCategoria ? selectCategoria.value : '';
            const nome = getInputValue('nome');
            const dono = getInputValue('dono');
            const setor = getInputValue('setor');
            const descricao = getInputValue('descricao');
            const hostname = getInputValue('hostname');
            const termoInput = document.getElementById('termo');
            const termoSelecionado = document.querySelector('input[name="existeTermo"]:checked');
            const existeTermo = termoSelecionado ? termoSelecionado.value : 'nao';

            if (!categoria || !nome || !dono || !setor) {
                alert('Por favor, preencha todos os campos obrigatórios.');
                return;
            }

            const formData = new FormData();
            formData.append('categoria', categoria);
            formData.append('nome', nome);
            formData.append('dono', dono);
            formData.append('setor', setor);
            formData.append('descricao', descricao);
            formData.append('hostname', hostname);

            if (existeTermo === 'sim' && termoInput && termoInput.files.length > 0) {
                formData.append('termo', termoInput.files[0]);
            }

            try {
                const res = await fetch(`${API_URL}equipamentos`, {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Erro desconhecido.');

                alert('Equipamento cadastrado com sucesso!');
                formCadastro.reset();
                if (termoInputContainer) termoInputContainer.style.display = 'none';
                setTimeout(() => {
                    fetchEquipamentos();
                }, 500);
            } catch (error) {
                console.error('Erro ao enviar formulário:', error);
                alert('Erro ao cadastrar equipamento: ' + error.message);
            }
        });
    }

    if (formCategoria) {
        formCategoria.addEventListener('submit', async e => {
            e.preventDefault();
            const novaCat = inputNovaCategoriaLista ? inputNovaCategoriaLista.value.trim() : '';
            if (!novaCat || categorias.includes(novaCat)) {
                alert('Categoria inválida ou já existente.');
                return;
            }
            try {
                const res = await fetch(`${API_URL}categorias`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoria: novaCat })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                categorias.push(novaCat);
                inputNovaCategoriaLista.value = '';
                renderCategorias();
            } catch (error) {
                alert('Erro ao adicionar categoria: ' + error.message);
            }
        });
    }

    fetchCategorias();
    fetchEquipamentos();
});
