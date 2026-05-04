'use strict';

/**
 * @param {{ Toast: object, Session: object }} deps
 */
export function createSyncModule(deps) {
  return {
    SyncStatus: {
      interval: null,
      isHost: false,

      init(isAdmin) {
        this.isHost = isAdmin;
        this.updateDisplay();

        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.updateDisplay(), 30000);
      },

      async updateDisplay() {
        const hostStatus = document.getElementById('sync-host-status');
        if (!hostStatus) return;

        if (this.isHost) {
          hostStatus.textContent = '🌐 Você é o HOST (servidor)';
          hostStatus.style.color = 'var(--success)';
        } else {
          const addr = await window.electronAPI.getSyncHostAddress(deps.Session.getToken());
          if (addr) {
            const result = await window.electronAPI.checkSyncHost(deps.Session.getToken(), addr);
            if (result.reachable) {
              hostStatus.textContent = `🔄 Sincronizado com ${addr}`;
              hostStatus.style.color = 'var(--success)';
            } else {
              hostStatus.textContent = `⚠️ Servidor ${addr} offline`;
              hostStatus.style.color = 'var(--warning)';
            }
          } else {
            hostStatus.textContent = '⚠️ Nenhum servidor encontrado';
            hostStatus.style.color = 'var(--text-light)';
          }
        }
      },

      async saveHostAddress() {
        const addr = document.getElementById('host-address-input')?.value.trim();
        if (!addr) {
          deps.Toast.warning('Digite o endereço do servidor');
          return;
        }
        await window.electronAPI.saveSyncHostAddress(deps.Session.getToken(), addr);
        deps.Toast.success('Endereço do servidor salvo');
        await this.updateDisplay();
      },

      async manualSync() {
        const addr = await window.electronAPI.getSyncHostAddress(deps.Session.getToken());
        if (!addr) {
          deps.Toast.warning('Nenhum endereço de servidor configurado');
          return;
        }
        deps.Toast.info('Sincronizando...');
        const result = await window.electronAPI.pullSync(deps.Session.getToken(), addr);
        if (result.success) {
          deps.Toast.success('Sincronização completa!');
        } else {
          deps.Toast.error(result.message);
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
