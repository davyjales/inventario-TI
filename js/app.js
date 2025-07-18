document.addEventListener('DOMContentLoaded', () => {
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.page-section');

    function showSection(id) {
        sections.forEach(section => {
            if (section.id === id) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
        navLinks.forEach(link => {
            if (link.getAttribute('href') === '#' + id) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            showSection(targetId);
        });
    });

    // Buttons on Home to navigate
    const btnCadastrar = document.getElementById('btn-cadastrar');
    const btnConsultar = document.getElementById('btn-consultar');

    btnCadastrar.addEventListener('click', () => {
        showSection('cadastro');
    });

    btnConsultar.addEventListener('click', () => {
        showSection('consulta');
    });

    // Backend API URL
    const API_URL = 'http://localhost:3000/';

    // Data arrays
    let equipamentos = [];
    let categorias = [];

    // Elements for Consulta
    const searchInput = document.getElementById('search-equipment');
    const filterModeSelect = document.getElementById('filter-mode');
    const equipmentList = document.getElementById('equipment-list');
    const equipmentDetails = document.getElementById('equipment-details');
    const btnVoltarConsulta = document.getElementById('btn-voltar-consulta');

    // Elements for Cadastro
    const formCadastro = document.getElementById('form-cadastro');
    const selectCategoria = document.getElementById('categoria');
    const inputNovaCategoria = document.getElementById('nova-categoria');

    // Elements for Categorias
    const categoriaLista = document.getElementById('categoria-lista');
    const formCategoria = document.getElementById('form-categoria');
    const inputNovaCategoriaLista = document.getElementById('input-nova-categoria');

    // Fetch categories from backend
    async function fetchCategorias() {
        try {
            const res = await fetch(`${API_URL}categorias`);
            categorias = await res.json();
            renderCategorias();
        } catch (error) {
            alert('Erro ao carregar categorias.');
        }
    }

    // Fetch equipamentos from backend
    async function fetchEquipamentos() {
        try {
            const res = await fetch(`${API_URL}equipamentos`);
            equipamentos = await res.json();
            renderEquipamentosList();
        } catch (error) {
            alert('Erro ao carregar equipamentos.');
        }
    }

    // Utility: Render categories in select and list
    function renderCategorias() {
        // Clear select options
        selectCategoria.innerHTML = '';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            selectCategoria.appendChild(option);
        });

        // Clear category list
        categoriaLista.innerHTML = '';
        categorias.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat;
            categoriaLista.appendChild(li);
        });
    }

    // Utility: Render equipment list
    function renderEquipamentosList(filter = '') {
        equipmentList.innerHTML = '';
        const filterMode = filterModeSelect.value;
        const filtered = equipamentos.filter(eq => {
            if (filterMode === 'categoria') {
                const categoriaValue = eq.categoria ? eq.categoria.toLowerCase() : '';
                return categoriaValue.includes(filter.toLowerCase());
            }
            const fieldValue = eq[filterMode] ? eq[filterMode].toLowerCase() : '';
            return fieldValue.includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            equipmentList.textContent = 'Nenhum equipamento encontrado.';
            return;
        }

        filtered.forEach(eq => {
            const div = document.createElement('div');
            div.className = 'equipment-item';
            div.innerHTML = `
                <h3>${eq.nome}</h3>
                <p><strong>Categoria:</strong> ${eq.categoria}</p>
                <p><strong>Nome do Dono:</strong> ${eq.dono || ''}</p>
                <p><strong>Setor:</strong> ${eq.setor || ''}</p>
                <p><strong>ID (QR Code):</strong> ${eq.qrCode}</p>
            `;
            div.addEventListener('click', () => {
                showEquipmentDetails(eq);
            });
            equipmentList.appendChild(div);
        });
    }

    // Show equipment details
    function showEquipmentDetails(eq) {
        equipmentDetails.innerHTML = `
            <h3>${eq.nome}</h3>
            <p><strong>Categoria:</strong> ${eq.categoria}</p>
            <p><strong>Nome do Dono:</strong> ${eq.dono || ''}</p>
            <p><strong>Setor:</strong> ${eq.setor || ''}</p>
            <p><strong>Descrição:</strong> ${eq.descricao}</p>
            <p><strong>ID (QR Code):</strong> ${eq.qrCode}</p>
        `;
        equipmentDetails.classList.remove('hidden');
        equipmentList.classList.add('hidden');
        btnVoltarConsulta.classList.remove('hidden');
    }

    // Back to equipment list from details
    btnVoltarConsulta.addEventListener('click', () => {
        equipmentDetails.classList.add('hidden');
        equipmentList.classList.remove('hidden');
        btnVoltarConsulta.classList.add('hidden');
    });

    // Search input event
    searchInput.addEventListener('input', () => {
        renderEquipamentosList(searchInput.value);
    });

    // Form cadastro submit
    formCadastro.addEventListener('submit', async (e) => {
        e.preventDefault();
        let categoria = selectCategoria.value;
        const novaCat = inputNovaCategoria.value.trim();

        // Validation: cannot select existing and add new category simultaneously unless "nao-existente" is selected
        if (categoria && novaCat && categoria !== 'nao-existente') {
            alert('Por favor, selecione uma categoria existente ou adicione uma nova, não ambos.');
            return;
        }

        // If "nao-existente" is selected, use novaCat as categoria
        if (categoria === 'nao-existente') {
            if (!novaCat) {
                alert('Por favor, preencha o campo de nova categoria.');
                return;
            }
            if (!categorias.includes(novaCat)) {
                // Add new category to backend
                try {
                    const res = await fetch(`${API_URL}categorias`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ categoria: novaCat })
                    });
                    if (!res.ok) {
                        const errorData = await res.json();
                        alert(errorData.error || 'Erro ao adicionar categoria.');
                        return;
                    }
                    categorias.push(novaCat);
                    categoria = novaCat;
                    renderCategorias();
                } catch (error) {
                    alert('Erro ao adicionar categoria.');
                    return;
                }
            } else {
                categoria = novaCat;
            }
            // Clear selectCategoria value to avoid conflict
            selectCategoria.value = '';
        }

        const nome = document.getElementById('nome').value.trim();
        const dono = document.getElementById('dono').value.trim();
        const setor = document.getElementById('setor').value.trim();
        const descricao = document.getElementById('descricao').value.trim();
        const qrCode = document.getElementById('qr-code').value.trim();

        if (!nome) {
            alert('Por favor, preencha o campo obrigatório: Service Tag.');
            return;
        }

        // Check for duplicate QR Code in local data
        if (equipamentos.some(eq => eq.qrCode === qrCode)) {
            alert('Já existe um equipamento com este QR Code.');
            return;
        }

        const novoEquip = {
            categoria,
            nome,
            dono,
            setor,
            descricao,
            qrCode
        };

        // Send new equipment to backend
        try {
            const res = await fetch(`${API_URL}equipamentos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novoEquip)
            });
            if (!res.ok) {
                const errorData = await res.json();
                alert(errorData.error || 'Erro ao cadastrar equipamento.');
                return;
            }
            alert('Equipamento cadastrado com sucesso!');
            formCadastro.reset();
            inputNovaCategoria.value = '';
            // Refresh equipment list
            await fetchEquipamentos();
        } catch (error) {
            alert('Erro ao cadastrar equipamento.');
        }
    });

    // Form categoria submit
    formCategoria.addEventListener('submit', async (e) => {
        e.preventDefault();
        const novaCat = inputNovaCategoriaLista.value.trim();
        if (!novaCat) {
            alert('Digite o nome da nova categoria.');
            return;
        }
        if (categorias.includes(novaCat)) {
            alert('Categoria já existe.');
            return;
        }
        // Add new category to backend
        try {
            const res = await fetch(`${API_URL}categorias`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ categoria: novaCat })
            });
            if (!res.ok) {
                const errorData = await res.json();
                alert(errorData.error || 'Erro ao adicionar categoria.');
                return;
            }
            categorias.push(novaCat);
            inputNovaCategoriaLista.value = '';
            renderCategorias();
        } catch (error) {
            alert('Erro ao adicionar categoria.');
        }
    });

    // Initialize by fetching data from backend
    fetchCategorias();
    fetchEquipamentos();
});
