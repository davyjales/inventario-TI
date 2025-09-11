document.addEventListener('DOMContentLoaded', () => {
          // Upload de termo (radios)
          const radios = document.getElementsByName('existeTermo');
          const termoContainer = document.getElementById('upload-termo-container');
          Array.from(radios || []).forEach(function(radio) {
            radio.addEventListener('change', function() {
              if (!termoContainer) return;
              termoContainer.style.display = (this.value === 'sim' && this.checked) ? 'block' : 'none';
            });
          });

      // Modal de senha
      const cancelarSenhaBtn = document.getElementById('cancelar-senha');
      const confirmarSenhaBtn = document.getElementById('confirmar-senha');
      const modalSenha = document.getElementById('modal-senha');

      cancelarSenhaBtn?.addEventListener('click', () => {
        modalSenha?.classList.add('hidden');
      });

      confirmarSenhaBtn?.addEventListener('click', async () => {
        const input = document.getElementById('nova-senha');
        const novaSenha = (input && 'value' in input) ? input.value : '';
        if (!novaSenha || novaSenha.length < 6) return alert('A senha deve ter no mínimo 6 caracteres.');

        try {
          const token = localStorage.getItem('token');
      const res = await fetch(`http://10.137.174.213:3000/api/usuarios/admin/alterar-senha/${idUsuarioAlterandoSenha}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          novaSenha: novaSenha
        })
      });

      const ct = res.headers.get('content-type') || '';
      const data = ct.includes('application/json') ? await res.json() : {};

      if (res.ok) {
        alert('Senha atualizada com sucesso!');
        modalSenha?.classList.add('hidden');
      } else {
        alert((data && (data.erro || data.message)) || 'Erro ao atualizar senha.');
      }
        } catch {
          alert('Erro de conexão.');
        }
      });

      // Decodifica token e configura visibilidade
      const token = localStorage.getItem('token');
      let isAdmin = false;
      let isInventariante = false;
      try {
        const decoded = jwt_decode(token);
        isAdmin = !!decoded?.admin;
        isInventariante = !!decoded?.inventariante;
      } catch {
        localStorage.removeItem('token');
        return (window.location.href = 'login.html');
      }

      if (isAdmin) {
        const adminLink = document.getElementById('admin-link');
        const adminSection = document.getElementById('admin');
        if (adminLink) adminLink.style.display = 'inline-block';
        if (adminSection) adminSection.style.display = 'block';
      }

      if (!isAdmin && !isInventariante) {
        document.getElementById('form-categoria')?.remove();
        document.getElementById('cadastro')?.remove();
        document.querySelector('a[href="#cadastro"]')?.remove();
        document.getElementById('btn-cadastrar')?.remove();
      }

      // Botões da home
      document.getElementById('btn-cadastrar')?.addEventListener('click', () => {
        document.querySelector('a[href="cadastroEquipamentos.html"]')?.click();
      });
      document.getElementById('btn-consultar')?.addEventListener('click', () => {
        document.querySelector('.nav-link[href="#consulta"]')?.click();
      });

      // Logout
      const logoutLink = document.getElementById('logout-link');
      logoutLink?.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = 'login.html';
      });

      // Navegação (abas) — permite navegação normal para status.html
      const links = document.querySelectorAll('.nav-link');
      const sections = document.querySelectorAll('.page-section');
      links.forEach(link => {
        link.addEventListener('click', e => {
          if (link.id === 'status-submenu-link') return; // não interfere no link de status.html
          e.preventDefault();
          const target = link.getAttribute('href')?.substring(1);
          links.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          sections.forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
          });
          if (target) {
            const targetSection = document.getElementById(target);
            if (targetSection) {
              targetSection.classList.add('active');
              targetSection.style.display = 'block';
            }
          }
        });
      });
      sections.forEach(section => {
        if (!section.classList.contains('active')) {
          section.style.display = 'none';
        }
      });

      // Preenche select de status (robusto)
      fetch('/api/status')
        .then(async res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) throw new Error('Resposta não é JSON');
          return res.json();
        })
        .then(statuses => {
          const statusSelect = document.getElementById('status');
          if (!statusSelect) return;
          statuses.forEach(status => {
            const option = document.createElement('option');
            option.value = status?.nome ?? '';
            option.textContent = status?.nome ?? '';
            statusSelect.appendChild(option);
          });
        })
        .catch(err => console.error('Erro ao carregar status para o select:', err));

      // Funções de atualização/contagem e filtros
      const tabela = document.querySelector('.tabela-equipamentos');
      const resultsInfo = document.querySelector('.results-info');
      const showing = document.getElementById('showing-results');
      const total = document.getElementById('total-results');
      const searchInput = document.getElementById('search-equipment');
      const filterMode = document.getElementById('filter-mode');

      // Admin: carregar usuários com robustez
      if (isAdmin) {
        fetch('http://10.137.174.213:3000/api/usuarios/admin/users', {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(async res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('application/json')) throw new Error('Resposta não é JSON');
            return res.json();
          })
          .then(users => {
            const tbody = document.getElementById('user-table-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            (users || []).forEach(user => {
              const tr = document.createElement('tr');
              tr.setAttribute('data-user-id', user.id);
              tr.innerHTML = `
                <td>${user?.nome ?? ''}</td>
                <td>${user?.user ?? ''}</td>
                <td>${user?.email ?? ''}</td>
                <td class="centralizado">
                  <input type="checkbox" ${user?.admin ? 'checked' : ''}
                         data-user-id="${user.id}" data-field="admin" class="user-permission" />
                </td>
                <td class="centralizado">
                  <input type="checkbox" ${user?.inventariante ? 'checked' : ''}
                         data-user-id="${user.id}" data-field="inventariante" class="user-permission" />
                </td>
                <td class="centralizado">
                  <input type="checkbox" ${user?.autorizado ? 'checked' : ''}
                         data-user-id="${user.id}" data-field="autorizado" class="user-permission" />
                </td>
                <td class="centralizado">
                  <button class="action-btn btn-password" onclick="abrirModalSenha(${user.id}, '${(user?.nome ?? '').replace(/'/g, "\\'")}')">🔐</button>
                  <button class="action-btn btn-delete" onclick="excluirUsuario(${user.id})">🗑️</button>
                </td>
              `;
              tbody.appendChild(tr);
            });
            setupPermissionCheckboxes();
          })
          .catch(err => {
            console.warn('Admin/users indisponível ou retornou conteúdo não-JSON:', err);
          });
      }

      function setupPermissionCheckboxes() {
        document.querySelectorAll('.user-permission').forEach(checkbox => {
          checkbox.addEventListener('change', function () {
            const userId = this.getAttribute('data-user-id');
            const field = this.getAttribute('data-field');
            const value = this.checked;
            updateUserPermission(userId, field, value);
          });
        });
      }

      async function updateUserPermission(userId, field, value) {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`http://10.137.174.213:3000/admin/update-permission`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ userId, field, value })
          });

          const ct = response.headers.get('content-type') || '';
          if (!ct.includes('application/json')) throw new Error('Resposta do servidor não é JSON');
          const data = await response.json();

          if (!response.ok) throw new Error(data?.message || 'Falha ao atualizar permissão');

          alert('Permissão atualizada com sucesso!');
        } catch (error) {
          console.error('Erro ao atualizar permissão:', error);
          alert(`Erro ao atualizar permissão: ${error?.message || error}`);
          const checkbox = document.querySelector(`.user-permission[data-user-id="${userId}"][data-field="${field}"]`);
          if (checkbox) checkbox.checked = !checkbox.checked;
        }
      }

      async function excluirUsuario(id) {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
        try {
          const token = localStorage.getItem('token');
          await fetch(`http://10.137.174.213:3000/api/usuarios/admin/excluir/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
          });
          const row = document.querySelector(`tr[data-user-id="${id}"]`);
          row?.parentElement?.removeChild(row);
        } catch (error) {
          console.error('Erro ao excluir usuário:', error);
          alert('Erro ao excluir usuário. Tente novamente.');
        }
      }
      window.excluirUsuario = excluirUsuario;
    });