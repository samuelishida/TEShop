'use strict';

/**
 * @param {{ Toast: typeof import('./toast.js').Toast }} deps
 */
export function createToastModule(deps) {
  return {
    Toast: {
      container: null,

      init() {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      },

      show(message, type = 'info', duration = 3000) {
        if (!this.container) this.init();

        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = icons[type] || 'ℹ️';

        const msgSpan = document.createElement('span');
        msgSpan.className = 'toast-message';
        msgSpan.textContent = String(message);

        toast.appendChild(iconSpan);
        toast.appendChild(msgSpan);
        this.container.appendChild(toast);

        setTimeout(() => {
          toast.style.animation = 'slideOut 0.3s ease forwards';
          toast.addEventListener('animationend', () => toast.remove());
        }, duration);
      },

      success(message) { this.show(message, 'success'); },
      error(message)   { this.show(message, 'error');   },
      warning(message){ this.show(message, 'warning');  },
      info(message)   { this.show(message, 'info');    },
    },
  };
}
