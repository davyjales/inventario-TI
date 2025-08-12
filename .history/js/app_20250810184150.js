document.addEventListener('DOMContentLoaded', () => {
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
            // Redireciona para login se o token for inválido
            window.location.href = 'login.html';
        }
    } else {
        // Redireciona para login se não houver token
        window.location.href = 'login.html';
    }

    
    // Função para fazer requisições autenticadas
    async function fetchWithAuth(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };
        
        return fetch(url, {
            ...options,
            headers
        });
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
    if (hash) {
        showSection(hash.substring(1));
    } else {
        showSection('home');
    }
    window.addEventListener('hashchange', () => {
        showSection(window.location.hash.substring(1));
    });

    const searchInput = document.getElementById('search-equipment');
    const filterModeSelect = document.getElementById('filter-mode');

    const formCadastro = document.getElementById('form-cadastro');
    const selectCategoria = document.getElementById('categoria');
    const categoriaLista = document.getElementById('categoria-lista');

    let categorias = [];
    let equipamentos = [];

    // Fetch categories from backend API
    async function fetchCategorias() {
        try {
            const res = await fetchWithAuth('/api/categorias');
            if (!res.ok) throw new Error('Erro ao buscar categorias');
            categorias = await res.json();
            renderCategorias();
        } catch (err) {
            console.error('Erro ao carregar categorias:', err);
            alert('Erro ao carregar categorias.');
        }
    }

    // Fetch equipment from backend API
    async function fetchEquipamentos() {
        try {
            const res = await fetchWithAuth('/api/equipamentos');
            if (!res.ok) throw new Error('Erro ao buscar equipamentos');
            equipamentos = await res.json();
            renderEquipamentosTable();
        } catch (err) {
            console.error('Erro ao carregar equipamentos:', err);
            alert('Erro ao carregar equipamentos.');
        }
    }

    // Render categories in dropdown and list
    function renderCategorias() {
        if (!selectCategoria || !categoriaLista) return;

        selectCategoria.innerHTML = '';
        categorias.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.nome;
            option.textContent = cat.nome;
            selectCategoria.appendChild(option);
        });

        categoriaLista.innerHTML = '';
        categorias.forEach(cat => {
            const li = document.createElement('li');
            li.textContent = cat.nome;
            categoriaLista.appendChild(li);
        });
    }

    // Add event listeners to column filter inputs
    document.querySelectorAll('.column-filter').forEach(input => {
        input.addEventListener('input', () => {
            renderEquipamentosTable();
        });
    });

    // Handle category creation form
    const formCategoria = document.getElementById('form-categoria');
    const checkboxCamposAdicionais = document.getElementById('checkbox-campos-adicionais');
    const camposAdicionaisContainer = document.getElementById('campos-adicionais-container');
    const btnAdicionarCampo = document.getElementById('btn-adicionar-campo');

    // Show/hide additional fields container based on checkbox
    if (checkboxCamposAdicionais) {
        checkboxCamposAdicionais.addEventListener('change', () => {
            camposAdicionaisContainer.style.display = checkboxCamposAdicionais.checked ? 'block' : 'none';
        });
    }

    // Add new additional field input set
    if (btnAdicionarCampo) {
        btnAdicionarCampo.addEventListener('click', () => {
            const index = camposAdicionaisContainer.querySelectorAll('.campo-adicional-item').length;
            const div = document.createElement('div');
            div.className = 'campo-adicional-item';
            div.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 5px;';
            div.innerHTML = `
                <input type="text" class="input-nome-campo" placeholder="Nome do campo adicional" aria-label="Nome do campo adicional" />
                <input type="checkbox" class="input-conteudo-unico" id="conteudo-unico-${index}" />
                <label for="conteudo-unico-${index}">Conteúdo único?</label>
                <button type="button" class="btn-remover-campo" aria-label="Remover campo adicional" style="background-color: #e74c3c; color: white; border: none; padding: 2px 8px; border-radius: 4px; cursor: pointer;">-</button>
            `;
            camposAdicionaisContainer.insertBefore(div, btnAdicionarCampo);

            // Add event listener to remove button
            div.querySelector('.btn-remover-campo').addEventListener('click', () => {
                div.remove();
            });
        });
    }

    // Handle category form submission
    if (formCategoria) {
        formCategoria.addEventListener('submit', async e => {
            e.preventDefault();
            const nomeCategoria = document.getElementById('input-nova-categoria').value.trim();
            if (!nomeCategoria) {
                alert('Digite o nome da categoria.');
                return;
            }

            // Check if category already exists
            if (categorias.some(cat => cat.nome.toLowerCase() === nomeCategoria.toLowerCase())) {
                alert('Categoria já existe.');
                return;
            }

            let additionalFields = [];
            if (checkboxCamposAdicionais && checkboxCamposAdicionais.checked) {
                const campos = camposAdicionaisContainer.querySelectorAll('.campo-adicional-item');
                for (const campo of campos) {
                    const nomeCampo = campo.querySelector('.input-nome-campo').value.trim();
                    const conteudoUnico = campo.querySelector('.input-conteudo-unico').checked;
                    if (!nomeCampo) {
                        alert('Preencha o nome de todos os campos adicionais.');
                        return;
                    }
                    additionalFields.push({ name: nomeCampo, unique: conteudoUnico });
                }
            }

            try {
                const res = await fetchWithAuth('/api/categorias', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome: nomeCategoria, additionalFields })
                });
                if (!res.ok) throw new Error('Erro ao adicionar categoria');
                await fetchCategorias();
                formCategoria.reset();
                camposAdicionaisContainer.innerHTML = '';
                camposAdicionaisContainer.style.display = 'none';
                checkboxCamposAdicionais.checked = false;
            } catch (err) {
                console.error('Erro ao adicionar categoria:', err);
                alert(err.message);
            }
        });
    }

    // Render additional fields in equipment form based on selected category
    const camposAdicionaisEquipamento = document.getElementById('campos-adicionais-equipamento');
    if (selectCategoria && camposAdicionaisEquipamento) {
        selectCategoria.addEventListener('change', () => {
            const selectedCatName = selectCategoria.value;
            const categoria = categorias.find(cat => cat.nome === selectedCatName);
            camposAdicionaisEquipamento.innerHTML = '';

            if (categoria && categoria.additionalFields && categoria.additionalFields.length > 0) {
                categoria.additionalFields.forEach((field, index) => {
                    const div = document.createElement('div');
                    div.style.marginBottom = '10px';

                    const label = document.createElement('label');
                    label.setAttribute('for', `campo-adicional-${index}`);
                    label.textContent = field.name + (field.unique ? ' *' : '');
                    label.style.fontWeight = 'bold';

                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = `campo-adicional-${index}`;
                    input.name = `campoAdicional_${index}`;
                    input.setAttribute('aria-label', field.name);
                    if (field.unique) input.required = true;

                    div.appendChild(label);
                    div.appendChild(document.createElement('br'));
                    div.appendChild(input);

                    camposAdicionaisEquipamento.appendChild(div);
                });
            }
        });
    }

    // Handle equipment form submission with additional fields validation
    if (formCadastro) {
        formCadastro.addEventListener('submit', async e => {
            e.preventDefault();

            const formData = new FormData(formCadastro);
            const categoriaNome = formData.get('categoria');
            const categoria = categorias.find(cat => cat.nome === categoriaNome);

            // Validate unique additional fields
            if (categoria && categoria.additionalFields) {
                for (let i = 0; i < categoria.additionalFields.length; i++) {
                    const field = categoria.additionalFields[i];
                    if (field.unique) {
                        const value = formData.get(`campoAdicional_${i}`).trim();
                        if (equipamentos.some(eq => eq.additionalFields && eq.additionalFields[field.name] === value)) {
                            alert(`O valor do campo "${field.name}" deve ser único.`);
                            return;
                        }
                    }
                }
            }

            try {
                const res = await fetchWithAuth('/api/equipamentos', {
                    method: 'POST',
                    body: formData
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || 'Erro ao cadastrar equipamento');
                }
                alert('Equipamento cadastrado com sucesso!');
                formCadastro.reset();
                if (camposAdicionaisEquipamento) camposAdicionaisEquipamento.innerHTML = '';
                await fetchEquipamentos();
                showSection('consulta');
            } catch (err) {
                console.error('Erro ao cadastrar equipamento:', err);
                alert(err.message);
            }
        });
    }
    
    // Controle das abas
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove a classe active de todas as abas e botões
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.report-tab, .history-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Adiciona a classe active apenas no botão e aba clicados
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Função para carregar o histórico
    async function loadEquipmentHistory() {
        try {
            const response = await fetchWithAuth('/api/historico');
            if (!response.ok) throw new Error('Erro ao carregar histórico');
            
            const history = await response.json();
            renderHistoryTable(history);
        } catch (error) {
            console.error('Erro ao carregar histórico:', error);
            alert('Não foi possível carregar o histórico');
        }
    }

    // Função para renderizar a tabela de histórico
    function renderHistoryTable(history) {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    history.forEach(item => {
        const tr = document.createElement('tr');
        
        // Formata as alterações corretamente
        let changesHtml = '';
        
        try {
            // Verifica se changed_fields é string (JSON) ou objeto
            const changes = typeof item.changed_fields === 'string' 
                ? JSON.parse(item.changed_fields) 
                : item.changed_fields;
            
            if (item.action === 'update' && changes) {
                changesHtml = '<ul style="margin: 0; padding-left: 20px;">';
                
                for (const [field, values] of Object.entries(changes)) {
                    // Verifica se values é um array [de, para] ou objeto {de, para}
                    const oldValue = Array.isArray(values) ? values[0] : values?.de;
                    const newValue = Array.isArray(values) ? values[1] : values?.para;
                    
                    changesHtml += `
                        <li style="list-style-type: none; position: relative; padding-left: 15px;">
                            <span style="position: absolute; left: 0;">•</span>
                            ${field}: ${formatHistoryValue(oldValue)} → ${formatHistoryValue(newValue)}
                        </li>
                    `;
                }
                
                changesHtml += '</ul>';
            } else if (item.action === 'create') {
                changesHtml = 'Equipamento criado';
            }
        } catch (e) {
            console.error('Erro ao processar histórico:', e);
            changesHtml = 'Erro ao carregar alterações';
        }
        
        // Formata a ação
        const actionText = {
            'create': 'Criação',
            'update': 'Atualização',
            'delete': 'Exclusão'
        }[item.action] || item.action;
        
        tr.innerHTML = `
            <td>${new Date(item.timestamp).toLocaleString()}</td>
            <td>${actionText}</td>
            <td>${item.user?.name || item.user?.name}</td>
            <td>${item.Equipment?.serviceTag || ''}</td>
            <td>${changesHtml}</td>
        `;
        
        tbody.appendChild(tr);
    });
    
    updateHistoryResultsCount(history.length, history.length);
}

    // Função auxiliar para formatar valores do histórico
    function formatHistoryValue(value) {
        if (value === null || value === undefined || value === '') return 'N/A';
        if (value === 'Não informado') return 'N/A';
        return value;
    }

    // Função para atualizar a contagem de resultados
    function updateHistoryResultsCount(showing, total) {
        const showingResults = document.getElementById('history-showing-results');
        const totalResults = document.getElementById('history-total-results');
        if (showingResults) showingResults.textContent = showing;
        if (totalResults) totalResults.textContent = total;
    }

    // Carrega o histórico quando a aba é aberta
    const historyTabBtn = document.querySelector('.tab-btn[data-tab="equipment-history"]');
    if (historyTabBtn) {
        historyTabBtn.addEventListener('click', loadEquipmentHistory);
    }

    // Initial fetch calls
    fetchCategorias();
    fetchEquipamentos();
});