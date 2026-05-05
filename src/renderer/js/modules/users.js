'use strict';

/**
 * @param {{ Toast: object, Utils: object, Modal: object, Session: object }} deps
 */
export function createUsersModule(deps) {
  return {
    Users: {
      async init() {
        const addBtn = document.getElementById('add-user-btn');
        if (addBtn) addBtn.addEventListener('click', () => deps.Modal.open('user-modal'));

        const form = document.getElementById('user-form');
        if (form) form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.createUser();
        });

        // Modal close buttons (user modal)
        this._bindModalClose('user-modal');

        // Change password button (sidebar)
        const cpBtn = document.getElementById('change-password-btn');
        if (cpBtn) cpBtn.addEventListener('click', () => deps.Modal.open('change-password-modal'));

        // Change password form
        const cpForm = document.getElementById('change-password-form');
        if (cpForm) cpForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.changePassword();
        });

        // Modal close buttons (change password modal)
        this._bindModalClose('change-password-modal');

        // Toggle delete button for current admin: can't delete self
        // Handled during renderTable by checking against current user
      },

      _bindModalClose(modalId) {
        const closeBtn = document.querySelector(`#${modalId} .modal-close`);
        if (closeBtn) closeBtn.addEventListener('click', () => deps.Modal.close(modalId));
        const cancelBtn = document.querySelector(`#${modalId} .modal-cancel`);
        if (cancelBtn) cancelBtn.addEventListener('click', () => deps.Modal.close(modalId));
      },

      async load() {
        try {
          const result = await window.electronAPI.listUsers(deps.Session.getToken());
          const users = Array.isArray(result) ? result : [];
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

        const currentUser = deps.Session.getUser();

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

          // Can only delete non-admin users, and not yourself
          if (user.role !== 'admin' && user.id !== currentUser?.id) {
            const delBtn = document.createElement('button');
            delBtn.className = 'btn btn-sm btn-danger';
            delBtn.textContent = '🗑️ Remover';
            delBtn.onclick = () => this.deleteUser(user.id, user.username);
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
        const role = document.getElementById('new-user-role').value;

        if (!username || !password) {
          deps.Toast.warning('Preencha todos os campos');
          return;
        }

        if (password.length < 4) {
          deps.Toast.warning('A senha deve ter pelo menos 4 caracteres');
          return;
        }

        try {
          const result = await window.electronAPI.createUser(deps.Session.getToken(), username, password, role);
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

      async changePassword() {
        const oldPassword = document.getElementById('old-password').value;
        const newPassword = document.getElementById('new-password-change').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (!oldPassword || !newPassword || !confirmPassword) {
          deps.Toast.warning('Preencha todos os campos');
          return;
        }

        if (newPassword.length < 4) {
          deps.Toast.warning('A nova senha deve ter pelo menos 4 caracteres');
          return;
        }

        if (newPassword !== confirmPassword) {
          deps.Toast.warning('As senhas não coincidem');
          return;
        }

        try {
          const result = await window.electronAPI.changePassword(
            deps.Session.getToken(),
            oldPassword,
            newPassword
          );
          if (result.success) {
            deps.Toast.success('Senha alterada com sucesso');
            deps.Modal.close('change-password-modal');
            document.getElementById('change-password-form').reset();
          } else {
            deps.Toast.error(result.message || 'Erro ao alterar senha');
          }
        } catch (error) {
          deps.Toast.error('Erro ao alterar senha');
        }
      },
    },
  };
}
