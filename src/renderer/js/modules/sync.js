'use strict';

/**
 * @param {{ Toast: object, Session: object }} deps
 */
export function createSyncModule(deps) {
  return {
    SyncStatus: {
      interval: null,
      isAdmin: false,

      init(isAdmin) {
        this.isAdmin = isAdmin;

        // Show sync controls only for cashiers — admin IS the host, no config needed
        const controls = document.getElementById('sync-controls');
        if (controls) {
          controls.style.display = isAdmin ? 'none' : 'block';
        }

        this.updateDisplay();

        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.updateDisplay(), 30000);
      },

      async updateDisplay() {
        const hostStatus = document.getElementById('sync-host-status');
        if (!hostStatus) return;

        if (this.isAdmin) {
          hostStatus.textContent = '🌐 Servidor ativo (HOST)';
          hostStatus.style.color = 'var(--success)';
          return;
        }

        // Cashier: check if configured host is reachable
        try {
          const addr = await window.electronAPI.getSyncHostAddress(deps.Session.getToken());
          if (!addr) {
            hostStatus.textContent = '⚠️ Servidor não configurado';
            hostStatus.style.color = 'var(--text-secondary)';

            // Pre-fill the input if element exists and is empty
            const input = document.getElementById('host-address-input');
            if (input && !input.value) input.value = '';
            return;
          }

          // Populate the address input so user can see/edit it
          const input = document.getElementById('host-address-input');
          if (input && !input.value) input.value = addr;

          const result = await window.electronAPI.checkSyncHost(deps.Session.getToken(), addr);
          if (result.reachable) {
            hostStatus.textContent = `✅ Sincronizado com ${addr}`;
            hostStatus.style.color = 'var(--success)';
          } else {
            hostStatus.textContent = `⚠️ Servidor ${addr} offline`;
            hostStatus.style.color = 'var(--warning)';
          }
        } catch (err) {
          console.error('Sync status error:', err);
        }
      },

      async saveHostAddress() {
        const addr = document.getElementById('host-address-input')?.value.trim();
        if (!addr) {
          deps.Toast.warning('Digite o endereço IP do servidor (ex: 192.168.1.100)');
          return;
        }
        try {
          await window.electronAPI.saveSyncHostAddress(deps.Session.getToken(), addr);
          deps.Toast.success('Endereço do servidor salvo');
          await this.updateDisplay();
        } catch (err) {
          deps.Toast.error('Erro ao salvar endereço');
        }
      },

      async manualSync() {
        try {
          const addr = await window.electronAPI.getSyncHostAddress(deps.Session.getToken());
          if (!addr) {
            deps.Toast.warning('Configure o endereço do servidor primeiro');
            return;
          }
          deps.Toast.info('Sincronizando...');
          const result = await window.electronAPI.pullSync(deps.Session.getToken(), addr);
          if (result.success) {
            deps.Toast.success('Sincronização concluída!');
            await this.updateDisplay();
          } else {
            deps.Toast.error(result.message || 'Erro na sincronização');
          }
        } catch (err) {
          deps.Toast.error('Erro ao sincronizar');
        }
      },

      destroy() {
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
      },
    },
  };
}
