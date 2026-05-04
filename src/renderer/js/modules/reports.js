'use strict';

/**
 * @param {{ Toast: object, Utils: object, Session: object }} deps
 */
export function createReportsModule(deps) {
  return {
    Reports: {
      setDefaultDates() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

        const startInput = document.getElementById('report-start-date');
        const endInput = document.getElementById('report-end-date');
        if (startInput) startInput.value = firstDay.toISOString().split('T')[0];
        if (endInput) endInput.value = today.toISOString().split('T')[0];
      },

      async init() {
        document.getElementById('generate-report-btn').addEventListener('click', () => {
          this.generateReport();
        });

        this.setDefaultDates();
      },

      async generateReport() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;

        if (!startDate || !endDate) {
          deps.Toast.warning('Selecione as datas');
          return;
        }

        try {
          const report = await window.electronAPI.getSalesReport(deps.Session.getToken(), startDate, endDate);

          const totalSales = document.getElementById('report-total-sales');
          const totalRevenue = document.getElementById('report-total-revenue');
          const dailyAverage = document.getElementById('report-daily-average');

          if (totalSales) totalSales.textContent = String(report.total_sales || report.totalSales || 0);
          if (totalRevenue) totalRevenue.textContent = deps.Utils.formatCurrency(report.total_revenue || report.totalRevenue || 0);
          if (dailyAverage) dailyAverage.textContent = deps.Utils.formatCurrency(report.daily_average || report.dailyAverage || 0);

          const tbody = document.querySelector('#top-products-table tbody');
          if (!tbody) return;

          tbody.textContent = '';

          const topProducts = report.top_products || report.topProducts || [];

          if (topProducts.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'Nenhum produto vendido no período';
            td.colSpan = 3;
            td.style.textAlign = 'center';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
          }

          for (const p of topProducts) {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.textContent = p.name || p.product_name || '';

            const qtyTd = document.createElement('td');
            qtyTd.textContent = String(p.quantity || p.total_quantity || 0);

            const revTd = document.createElement('td');
            revTd.textContent = deps.Utils.formatCurrency(p.revenue || p.total_revenue || 0);

            tr.appendChild(nameTd);
            tr.appendChild(qtyTd);
            tr.appendChild(revTd);
            tbody.appendChild(tr);
          }

          deps.Toast.success('Relatório gerado!');
        } catch (error) {
          console.error('Generate report error:', error);
          deps.Toast.error('Erro ao gerar relatório');
        }
      },
    },
  };
}
