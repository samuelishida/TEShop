'use strict';

/**
 * @param {{ Toast: object, Utils: object, POS: object, Products: object, Categories: object, Reports: object, Users: object }} deps
 */
export function createNavigationModule(deps) {
  return {
    Navigation: {
      currentPage: 'dashboard',

      init() {
        document.querySelectorAll('.nav-item').forEach(item => {
          item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page) this.goTo(page);
          });
        });
      },

      goTo(page) {
        this.currentPage = page;

        document.querySelectorAll('.nav-item').forEach(item => {
          item.classList.toggle('active', item.dataset.page === page);
        });

        document.querySelectorAll('.page').forEach(p => {
          p.classList.toggle('active', p.id === `${page}-page`);
        });

        switch (page) {
          case 'dashboard':  deps.Dashboard.load();   break;
          case 'pos':        deps.POS.loadProducts(); break;
          case 'products':   deps.Products.load();    break;
          case 'categories': deps.Categories.load();  break;
          case 'reports':    deps.Reports.setDefaultDates(); break;
          case 'users':     deps.Users.load();        break;
        }
      },
    },
  };
}
