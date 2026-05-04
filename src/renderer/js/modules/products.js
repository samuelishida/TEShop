'use strict';

/**
 * @param {{ Toast: object, Utils: object, Cart: object, Modal: object, POS: object, Dashboard: object, Session: object }} deps
 */
export function createProductsModule(deps) {
  return {
    Products: {
      allProducts: [],
      categories: [],
      editingId: null,

      async init() {
        document.getElementById('add-product-btn').addEventListener('click', () => {
          this.openProductModal();
        });

        document.getElementById('product-form').addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveProduct();
        });

        document.getElementById('product-search').addEventListener('input', deps.Utils.debounce((e) => {
          const query = e.target.value.toLowerCase();
          const filtered = this.allProducts.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query)
          );
          this.renderTable(filtered);
        }, 200));

        document.querySelector('#product-modal .modal-close').addEventListener('click', () => {
          deps.Modal.close('product-modal');
        });
        document.querySelector('#product-modal .modal-cancel').addEventListener('click', () => {
          deps.Modal.close('product-modal');
        });
      },

      async load() {
        try {
          this.allProducts = await window.electronAPI.findAllProducts(deps.Session.getToken());
          this.categories = await window.electronAPI.findAllCategories(deps.Session.getToken());
          this.renderTable(this.allProducts);
        } catch (error) {
          console.error('Load products error:', error);
          deps.Toast.error('Erro ao carregar produtos');
        }
      },

      renderTable(products) {
        const tbody = document.querySelector('#products-table tbody');
        if (!tbody) return;

        tbody.textContent = '';

        if (products.length === 0) {
          const tr = document.createElement('tr');
          const td = document.createElement('td');
          td.textContent = 'Nenhum produto encontrado';
          td.colSpan = 6;
          td.style.textAlign = 'center';
          tr.appendChild(td);
          tbody.appendChild(tr);
          return;
        }

        for (const product of products) {
          const category = this.categories.find(c => c.id === product.category_id);

          const tr = document.createElement('tr');

          const skuTd = document.createElement('td');
          skuTd.textContent = product.sku;

          const nameTd = document.createElement('td');
          nameTd.textContent = product.name;

          const catTd = document.createElement('td');
          catTd.textContent = category ? category.name : '-';

          const priceTd = document.createElement('td');
          priceTd.textContent = deps.Utils.formatCurrency(product.price);

          const stockTd = document.createElement('td');
          stockTd.textContent = String(product.stock);

          let badgeText = '';
          let badgeClass = '';
          if (product.stock === 0) {
            badgeText = 'Sem estoque';
            badgeClass = 'badge badge-danger';
          } else if (product.stock <= 10) {
            badgeText = 'Estoque baixo';
            badgeClass = 'badge badge-warning';
          } else {
            badgeText = 'OK';
            badgeClass = 'badge badge-success';
          }

          const badge = document.createElement('span');
          badge.className = badgeClass;
          badge.textContent = badgeText;
          stockTd.textContent = String(product.stock) + ' ';
          stockTd.appendChild(badge);

          const actionsTd = document.createElement('td');

          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-sm btn-outline';
          editBtn.textContent = '✏️';
          editBtn.onclick = () => deps.Products.edit(product.id);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-sm btn-danger';
          delBtn.textContent = '🗑️';
          delBtn.onclick = () => deps.Products.remove(product.id);

          actionsTd.appendChild(editBtn);
          actionsTd.appendChild(delBtn);

          tr.appendChild(skuTd);
          tr.appendChild(nameTd);
          tr.appendChild(catTd);
          tr.appendChild(priceTd);
          tr.appendChild(stockTd);
          tr.appendChild(actionsTd);
          tbody.appendChild(tr);
        }
      },

      async openProductModal(product = null) {
        this.editingId = product ? product.id : null;
        document.getElementById('product-modal-title').textContent = product ? 'Editar Produto' : 'Novo Produto';

        const select = document.getElementById('product-category');
        select.textContent = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Selecione...';
        select.appendChild(placeholder);
        for (const cat of this.categories) {
          const opt = document.createElement('option');
          opt.value = String(cat.id);
          opt.textContent = cat.name;
          select.appendChild(opt);
        }

        if (product) {
          document.getElementById('product-id').value = String(product.id);
          document.getElementById('product-sku').value = product.sku;
          document.getElementById('product-name').value = product.name;
          document.getElementById('product-category').value = String(product.category_id);
          document.getElementById('product-price').value = String(product.price);
          document.getElementById('product-stock').value = String(product.stock);
          document.getElementById('product-data').value = product.data
            ? JSON.stringify(product.data, null, 2) : '';
        } else {
          document.getElementById('product-form').reset();
          document.getElementById('product-id').value = '';
        }

        deps.Modal.open('product-modal');
      },

      edit(productId) {
        const product = this.allProducts.find(p => p.id === productId);
        if (product) this.openProductModal(product);
      },

      async saveProduct() {
        const id = document.getElementById('product-id').value;
        const sku = document.getElementById('product-sku').value.trim();
        const name = document.getElementById('product-name').value.trim();
        const categoryId = parseInt(document.getElementById('product-category').value) || null;
        const price = parseFloat(document.getElementById('product-price').value);
        const stock = parseInt(document.getElementById('product-stock').value);
        const dataStr = document.getElementById('product-data').value.trim();

        let data = null;
        if (dataStr) {
          try {
            data = JSON.parse(dataStr);
          } catch {
            deps.Toast.error('JSON inválido nos metadados');
            return;
          }
        }

        try {
          if (id) {
            await window.electronAPI.updateProduct(deps.Session.getToken(), parseInt(id), {
              sku, name, category_id: categoryId, price, stock, data,
            });
            deps.Toast.success('Produto atualizado!');
          } else {
            await window.electronAPI.createProduct(deps.Session.getToken(), {
              sku, name, category_id: categoryId, price, stock, data,
            });
            deps.Toast.success('Produto criado!');
          }

          deps.Modal.close('product-modal');
          await this.load();
          deps.POS.loadProducts();
        } catch (error) {
          console.error('Save product error:', error);
          deps.Toast.error('Erro ao salvar produto: ' + (error.message || error));
        }
      },

      async remove(productId) {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;

        try {
          await window.electronAPI.deleteProduct(deps.Session.getToken(), productId);
          deps.Toast.success('Produto excluído!');
          await this.load();
          deps.POS.loadProducts();
        } catch (error) {
          console.error('Delete product error:', error);
          deps.Toast.error('Erro ao excluir produto');
        }
      },
    },
  };
}
