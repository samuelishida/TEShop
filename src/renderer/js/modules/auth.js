'use strict';

/**
 * @param {{ Toast: object, Utils: object, Cart: object, Dashboard: object, SyncStatus: object, Navigation: object, Session: object }} deps
 */
export function createAuthModule(deps) {
  return {
    Auth: {
      currentUser: null,

      async login(username, password) {
        try {
          const result = await window.electronAPI.login({ username, password });
          if (result.success) {
            this.currentUser = result.user;
            document.getElementById('login-error').textContent = '';
            if (deps.Session) {
              deps.Session.save(result.token || '', result.user || {});
            }
            this.showApp();
            deps.Toast.success(`Bem-vindo, ${username}!`);
            deps.Dashboard.load();
            return true;
          } else {
            const msg = result.message || 'Credenciais inválidas';
            document.getElementById('login-error').textContent = msg;
            deps.Toast.error(msg);
            return false;
          }
        } catch (error) {
          const msg = error.message || 'Erro ao fazer login';
          document.getElementById('login-error').textContent = msg;
          deps.Toast.error(msg);
          return false;
        }
      },

      async restoreSession(user) {
        // Validate the token with the backend before restoring
        const token = deps.Session ? deps.Session.getToken() : null;
        if (token) {
          const validation = await window.electronAPI.validateToken(token);
          if (!validation.valid) {
            // Token is expired or invalid — force logout
            deps.Session.clear();
            return;
          }
        }
        this.currentUser = user;
        this.showApp();
        deps.Dashboard.load();
      },

      showApp() {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');

        const isAdmin = this.currentUser && this.currentUser.role === 'admin';
        document.querySelectorAll('.admin-only').forEach(el => {
          el.style.display = isAdmin ? '' : 'none';
        });

        if (!isAdmin) {
          deps.Navigation.goTo('pos');
        }

        deps.SyncStatus.init(isAdmin);
      },

      logout() {
        this.currentUser = null;
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('login-screen').classList.add('active');
        document.getElementById('login-form').reset();
        document.getElementById('login-error').textContent = '';
      },
    },
  };
}
