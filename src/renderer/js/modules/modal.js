'use strict';

export function createModalModule(deps) {
  return {
    Modal: {
      _escHandler: null,

      open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'flex';
        modal.classList.add('active');

        // Close on backdrop click
        modal._backdropHandler = (e) => {
          if (e.target === modal) this.close(modalId);
        };
        modal.addEventListener('click', modal._backdropHandler);

        // Register Escape key to close this modal
        if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
        this._escHandler = (e) => {
          if (e.key === 'Escape') this.close(modalId);
        };
        document.addEventListener('keydown', this._escHandler);
      },

      close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        modal.style.display = 'none';
        modal.classList.remove('active');

        if (modal._backdropHandler) {
          modal.removeEventListener('click', modal._backdropHandler);
          delete modal._backdropHandler;
        }

        if (this._escHandler) {
          document.removeEventListener('keydown', this._escHandler);
          this._escHandler = null;
        }
      },

      closeAll() {
        document.querySelectorAll('.modal').forEach(modal => {
          modal.style.display = 'none';
          modal.classList.remove('active');
          if (modal._backdropHandler) {
            modal.removeEventListener('click', modal._backdropHandler);
            delete modal._backdropHandler;
          }
        });
        if (this._escHandler) {
          document.removeEventListener('keydown', this._escHandler);
          this._escHandler = null;
        }
      },
    },
  };
}
