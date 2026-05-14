'use strict';

/**
 * @param {{ Toast: object, Utils: object, Session: object }} deps
 */
export function createReportsModule(deps) {
  return {
    Reports: {
      setDefaultDates() {
        const today = new Date();
        // Use local date components to avoid timezone shifts
        const localDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        const fmtLocal = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        const firstDay = new Date(localDate.getFullYear(), localDate.getMonth(), 1);

        const startInput = document.getElementById('report-start-date');
        const endInput = document.getElementById('report-end-date');
        if (startInput && !startInput.value) startInput.value = fmtLocal(firstDay);
        if (endInput && !endInput.value) endInput.value = fmtLocal(localDate);
      },

      async init() {
        const btn = document.getElementById('generate-report-btn');
        if (btn) btn.addEventListener('click', () => this.generateReport());

        this.setDefaultDates();
      },

      async generateReport() {
        const startInput = document.getElementById('report-start-date');
        const endInput = document.getElementById('report-end-date');
        const startDate = startInput?.value;
        const endDate = endInput?.value;

        if (!startDate || !endDate) {
          deps.Toast.warning('Selecione as datas de início e fim');
          return;
        }

        if (startDate > endDate) {
          deps.Toast.warning('Data de início não pode ser maior que a data fim');
          return;
        }

        const btn = document.getElementById('generate-report-btn');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Gerando...';
        }

        try {
          const report = await window.electronAPI.getSalesReport(deps.Session.getToken(), startDate, endDate);

          const totalSales = document.getElementById('report-total-sales');
          const totalRevenue = document.getElementById('report-total-revenue');
          const dailyAverage = document.getElementById('report-daily-average');

          if (totalSales) totalSales.textContent = String(report.total_sales ?? 0);
          if (totalRevenue) totalRevenue.textContent = deps.Utils.formatCurrency(report.total_revenue ?? 0);
          if (dailyAverage) dailyAverage.textContent = deps.Utils.formatCurrency(report.daily_average ?? 0);

          const tbody = document.querySelector('#top-products-table tbody');
          if (!tbody) return;

          tbody.textContent = '';

          const topProducts = report.top_products ?? [];

          if (topProducts.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.textContent = 'Nenhum produto vendido no período';
            td.colSpan = 3;
            td.style.textAlign = 'center';
            td.style.padding = '1rem';
            td.style.color = 'var(--text-secondary)';
            tr.appendChild(td);
            tbody.appendChild(tr);
            deps.Toast.info('Nenhuma venda encontrada no período selecionado');
            return;
          }

          for (const p of topProducts) {
            const tr = document.createElement('tr');

            const nameTd = document.createElement('td');
            nameTd.textContent = p.name ?? '';

            const qtyTd = document.createElement('td');
            qtyTd.textContent = String(p.quantity ?? 0);

            const revTd = document.createElement('td');
            revTd.textContent = deps.Utils.formatCurrency(p.revenue ?? 0);

            tr.appendChild(nameTd);
            tr.appendChild(qtyTd);
            tr.appendChild(revTd);
            tbody.appendChild(tr);
          }

          deps.Toast.success(`Relatório gerado: ${report.total_sales ?? 0} venda(s)`);
        } catch (error) {
          console.error('Generate report error:', error);
          deps.Toast.error('Erro ao gerar relatório. Verifique sua sessão e tente novamente.');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.textContent = 'Gerar Relatório';
          }
        }
      },
    },
  };
}
