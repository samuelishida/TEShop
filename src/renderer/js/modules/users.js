'use strict';

/**
 * @param {{ Toast: object, Utils: object, Modal: object, Session: object }} deps
 */
export function createUsersModule(deps) {
  return {
    Users: {
      async init() {
        document.getElementById('add-user-btn').addEventListener('click', () => {
          deps.Modal.open('user-modal');
        });

        document.getElementById('user-form').addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.createUser();
        });

        document.querySelector('#user-modal .modal-close').addEventListener('click', () => {
          deps.Modal.close('user-modal');
        });
        document.querySelector('#user-modal .modal-cancel').addEventListener('click', () => {
          deps.Modal.close('user-modal');
        });
      },

      async load() {
        try {
          const users = await window.electronAPI.listUsers(deps.Session.getToken());
          this.renderTable(users);
        } catch (error) {
          console.error('Load users error:', error);
          deps.Toast.error('Erro ao carregar usuários');
        }
      },

      renderTable(users) {
        const tbody = document.querySelector('#users-table tbody');
        if (!tbody) return;

        tbody.textContent = '';

        if (users.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.textContent = 'Nenhum usuário encontrado';
          td.colSpan = 4;
          td.style.textAlign = 'center';
          tr.appendChild(td);
          tbody.appendChild(tr);
          return;
        }

        for (const user of users) {
          const tr = document.createElement('tr');

          const userTd = document.createElement('td');
          userTd.textContent = user.username;

          const roleTd = document.createElement('td');
          const roleBadge = document.createElement('span');
          roleBadge.className = 'badge ' + (user.role === 'admin' ? 'badge-primary' : 'badge-info');
          roleBadge.textContent = user.role === 'admin' ? 'Administrador' : 'Caixa';
          roleTd.appendChild(roleBadge);

          const createdTd = document.createElement('td');
          createdTd.textContent = deps.Utils.formatDate(user.created_at);

          const actionsTd = document.createElement('td');

          if (user.role !== 'admin') {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-danger';
            delBtn.textContent = '🗑️ Remover';
            delBtn.onclick = () => deps.Users.deleteUser(user.id, user.username);
            actionsTd.appendChild(delBtn);
          } else {
            const noAction = document.createElement('span');
            noAction.className = 'text-muted';
            noAction.textContent = '—';
            actionsTd.appendChild(noAction);
          }

          tr.appendChild(userTd);
          tr.appendChild(roleTd);
          tr.appendChild(createdTd);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        }
      },

      async createUser() {
        const username = document.getElementById('new-username').value.trim();
        const password = document.getElementById('new-password').value;

        if (!username || !password) {
          deps.Toast.warning('Preencha todos os campos');
          return;
        }

        if (password.length < 4) {
          deps.Toast.warning('A senha deve ter pelo menos 4 caracteres');
          return;
        }

        try {
          const result = await window.electronAPI.createCashierUser(deps.Session.getToken(), username, password);
          if (result.success) {
            deps.Toast.success(result.message);
            deps.Modal.close('user-modal');
            document.getElementById('user-form').reset();
            await this.load();
          } else {
            deps.Toast.error(result.message);
          }
        } catch (error) {
          deps.Toast.error('Erro ao criar usuário');
        }
      },

      async deleteUser(userId, username) {
        if (!confirm(`Tem certeza que deseja remover o usuário "${username}"?`)) return;

        try {
          const result = await window.electronAPI.deleteUser(deps.Session.getToken(), userId);
          if (result.success) {
            deps.Toast.success(result.message);
            await this.load();
          } else {
            deps.Toast.error(result.message);
          }
        } catch (error) {
          deps.Toast.error('Erro ao remover usuário');
        }
      },
    },
  };
}
