'use strict';

/**
 * @param {{ Toast: object, Utils: object, Session: object }} deps
 */
export function createDashboardModule(deps) {
  return {
    Dashboard: {
      async load() {
        try {
          const revenue = await window.electronAPI.getTodayRevenue(deps.Session.getToken());
          document.getElementById('today-revenue').textContent = deps.Utils.formatCurrency(revenue);

          const todaySales = await window.electronAPI.getTodaySales(deps.Session.getToken());
          document.getElementById('today-sales-count').textContent = String(todaySales.length);

          const products = await window.electronAPI.findAllProducts(deps.Session.getToken());
          document.getElementById('total-products').textContent = String(products.length);

          const lowStock = await window.electronAPI.getLowStockProducts(deps.Session.getToken(), 10);
          document.getElementById('low-stock-count').textContent = String(lowStock.length);

          await this.loadRecentSales();
        } catch (error) {
          console.error('Dashboard load error:', error);
          deps.Toast.error('Erro ao carregar dashboard');
        }
      },

      async loadRecentSales() {
        try {
          const sales = await window.electronAPI.findRecentSales(deps.Session.getToken(), 10);
          const tbody = document.querySelector('#recent-sales-table tbody');
          if (!tbody) return;

          tbody.textContent = '';

          if (sales.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'Nenhuma venda recente';
            td.colSpan = 7;
            td.style.textAlign = 'center';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
          }

          const labels = { cash: 'Dinheiro', credit: 'Crédito', debit: 'Débito', pix: 'PIX' };
          const statusLabels = { completed: 'Concluída', cancelled: 'Cancelada' };

          for (const sale of sales) {
            const tr = document.createElement('tr');
            if (sale.status === 'cancelled') {
              tr.style.opacity = '0.5';
              tr.style.textDecoration = 'line-through';
            }

            const id = document.createElement('td');
            id.textContent = '#' + sale.id;

            const items = document.createElement('td');
            items.textContent = (sale.items ? sale.items.length : 0) + ' item(s)';

            const total = document.createElement('td');
            total.textContent = deps.Utils.formatCurrency(sale.total);

            const pay = document.createElement('td');
            pay.textContent = labels[sale.payment_method] || sale.payment_method;

            const status = document.createElement('td');
            const statusBadge = document.createElement('span');
            statusBadge.className = sale.status === 'cancelled' ? 'badge badge-danger' : 'badge badge-success';
            statusBadge.textContent = statusLabels[sale.status] || sale.status;
            status.appendChild(statusBadge);

            const time = document.createElement('td');
            time.textContent = deps.Utils.formatTime(sale.created_at);

            const actions = document.createElement('td');
            if (sale.status !== 'cancelled') {
              const cancelBtn = document.createElement('button');
              cancelBtn.className = 'btn btn-sm btn-danger';
              cancelBtn.textContent = 'Cancelar';
              cancelBtn.onclick = () => deps.Dashboard.cancelSale(sale.id);
              actions.appendChild(cancelBtn);
            } else {
              const noAction = document.createElement('span');
              noAction.className = 'text-muted';
              noAction.textContent = '—';
              actions.appendChild(noAction);
            }

            tr.appendChild(id);
            tr.appendChild(items);
            tr.appendChild(total);
            tr.appendChild(pay);
            tr.appendChild(status);
            tr.appendChild(time);
            tr.appendChild(actions);
            tbody.appendChild(tr);
          }
        } catch (error) {
          console.error('Recent sales load error:', error);
        }
      },

      async cancelSale(saleId) {
        if (!confirm(`Tem certeza que deseja cancelar a venda #${saleId}? O estoque será restaurado.`)) return;

        try {
          const result = await window.electronAPI.cancelSale(deps.Session.getToken(), saleId);
          if (result.success) {
            deps.Toast.success(result.message);
            await this.load();
          } else {
            deps.Toast.error(result.message || 'Erro ao cancelar venda');
          }
        } catch (error) {
          deps.Toast.error('Erro ao cancelar venda');
        }
      },
    },
  };
}
