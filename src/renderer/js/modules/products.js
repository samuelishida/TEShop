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
        const addBtn = document.getElementById('add-product-btn');
        if (addBtn) addBtn.addEventListener('click', () => this.openProductModal());

        const importBtn = document.getElementById('import-csv-btn');
        if (importBtn) importBtn.addEventListener('click', () => this.openCsvImportModal());

        const form = document.getElementById('product-form');
        if (form) form.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveProduct();
        });

        const search = document.getElementById('product-search');
        if (search) search.addEventListener('input', deps.Utils.debounce((e) => {
          const query = e.target.value.toLowerCase();
          const filtered = this.allProducts.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.sku.toLowerCase().includes(query)
          );
          this.renderTable(filtered);
        }, 200));

        const closeBtn = document.querySelector('#product-modal .modal-close');
        if (closeBtn) closeBtn.addEventListener('click', () => deps.Modal.close('product-modal'));
        const cancelBtn = document.querySelector('#product-modal .modal-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => deps.Modal.close('product-modal'));

        // CSV import modal handlers
        const csvClose = document.querySelector('#csv-import-modal .modal-close');
        if (csvClose) csvClose.addEventListener('click', () => deps.Modal.close('csv-import-modal'));
        const csvCancel = document.querySelector('#csv-import-modal .modal-cancel');
        if (csvCancel) csvCancel.addEventListener('click', () => deps.Modal.close('csv-import-modal'));
        const csvBtn = document.getElementById('csv-import-btn');
        if (csvBtn) csvBtn.addEventListener('click', () => this.importCsv());

        const csvFile = document.getElementById('csv-file-input');
        if (csvFile) csvFile.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (file) this.readCsvFile(file);
        });

        const downloadTpl = document.getElementById('download-csv-template');
        if (downloadTpl) downloadTpl.addEventListener('click', (e) => {
          e.preventDefault();
          this.downloadCsvTemplate();
        });

        const csvTextarea = document.getElementById('csv-text-input');
        if (csvTextarea) csvTextarea.addEventListener('input', () => {
          // just tracks changes
        });

        // Category change handler for dynamic fields
        const categorySelect = document.getElementById('product-category');
        if (categorySelect) categorySelect.addEventListener('change', () => this.onCategoryChange());

        // Unit change handler — services disable stock field
        const unitSelect = document.getElementById('product-unit');
        if (unitSelect) unitSelect.addEventListener('change', () => this.onUnitChange());
      },

      onUnitChange() {
        const unit = document.getElementById('product-unit')?.value;
        const stockInput = document.getElementById('product-stock');
        const stockWrapper = stockInput?.closest('.form-group');

        if (unit === 'servico') {
          if (stockInput) {
            stockInput.value = '0';
            stockInput.disabled = true;
          }
          if (stockWrapper) {
            stockWrapper.style.opacity = '0.4';
            stockWrapper.title = 'Serviços não controlam estoque';
          }
        } else {
          if (stockInput) stockInput.disabled = false;
          if (stockWrapper) {
            stockWrapper.style.opacity = '';
            stockWrapper.title = '';
          }
        }
      },

      onCategoryChange() {
        const categoryId = parseInt(document.getElementById('product-category').value) || 0;
        const hint = document.querySelector('#category-fields > p');
        const container = document.getElementById('dynamic-category-fields');

        if (hint) hint.style.display = categoryId ? 'none' : 'block';
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'none';

        if (!categoryId) return;

        const category = this.categories.find(c => c.id === categoryId);
        if (!category || !category.config || !category.config.fields) return;

        container.style.display = 'block';

        for (const field of category.config.fields) {
          const wrapper = document.createElement('div');
          wrapper.className = 'form-group';

          const label = document.createElement('label');
          label.htmlFor = `field-${field.id}`;
          label.textContent = field.label;
          wrapper.appendChild(label);

          let input;
          if (field.type === 'select' && field.options) {
            input = document.createElement('select');
            for (const opt of field.options) {
              const option = document.createElement('option');
              option.value = opt.value;
              option.textContent = opt.label;
              input.appendChild(option);
            }
          } else if (field.type === 'textarea') {
            input = document.createElement('textarea');
            input.rows = 3;
          } else {
            input = document.createElement('input');
            input.type = field.type === 'number' ? 'number' : 'text';
            if (field.type === 'number') {
              input.step = '0.01';
              input.min = '0';
            }
          }

          input.id = `field-${field.id}`;
          if (field.placeholder) input.placeholder = field.placeholder;
          if (field.required) input.required = true;

          wrapper.appendChild(input);
          container.appendChild(wrapper);
        }
      },

      async load() {
        try {
          const productsResult = await window.electronAPI.findAllProducts(deps.Session.getToken(), { limit: 500 });
          const categoriesResult = await window.electronAPI.findAllCategories(deps.Session.getToken(), { limit: 500 });

          const products = Array.isArray(productsResult) ? productsResult : (productsResult?.data || []);
          const categories = Array.isArray(categoriesResult) ? categoriesResult : (categoriesResult?.data || []);

          if (products.length === 0 && productsResult?.error) {
            deps.Toast.error(productsResult.error);
            return;
          }
          if (categories.length === 0 && categoriesResult?.error) {
            deps.Toast.error(categoriesResult.error);
            return;
          }

          this.allProducts = products;
          this.categories = categories;
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
          const data = deps.Utils.safeParseJSON(product.data, {});
          const isService = data?.unit === 'servico';

          if (isService) {
            const badge = document.createElement('span');
            badge.className = 'badge badge-info';
            badge.textContent = 'Serviço';
            stockTd.appendChild(badge);
          } else {
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
          }

          const actionsTd = document.createElement('td');

          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-sm btn-outline';
          editBtn.textContent = '✏️';
          editBtn.onclick = () => this.edit(product.id);

          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-sm btn-danger';
          delBtn.textContent = '🗑️';
          delBtn.onclick = () => this.remove(product.id);

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

        // Load categories dynamically into select
        await this.loadCategoriesIntoSelect();

        // Reset dynamic fields
        const container = document.getElementById('dynamic-category-fields');
        if (container) {
          container.innerHTML = '';
          container.style.display = 'none';
        }
        const hint = document.querySelector('#category-fields > p');
        if (hint) hint.style.display = 'block';

        if (product) {
          document.getElementById('product-id').value = String(product.id);
          document.getElementById('product-sku').value = product.sku;
          document.getElementById('product-name').value = product.name;
          document.getElementById('product-category').value = String(product.category_id || '');
          document.getElementById('product-price').value = String(product.price);
          document.getElementById('product-stock').value = String(product.stock);

          // Populate unit if in data
          const data = deps.Utils.safeParseJSON(product.data, {});
          if (data.unit) {
            document.getElementById('product-unit').value = data.unit;
          }

          // Apply unit-based UI rules (e.g. disable stock for services)
          this.onUnitChange();

          // Trigger category fields
          this.onCategoryChange();

          // Populate category-specific fields from data
          if (data) {
            const category = this.categories.find(c => c.id === product.category_id);
            if (category && category.config && category.config.fields) {
              for (const field of category.config.fields) {
                const el = document.getElementById(`field-${field.id}`);
                if (el && data[field.id] !== undefined) {
                  el.value = String(data[field.id]);
                }
              }
            }
          }
        } else {
          document.getElementById('product-form').reset();
          document.getElementById('product-id').value = '';
          // Ensure stock field is enabled for new products (form.reset() doesn't clear disabled)
          this.onUnitChange();
        }

        deps.Modal.open('product-modal');
      },

      async loadCategoriesIntoSelect() {
        const select = document.getElementById('product-category');
        if (!select) return;

        // Clear existing options
        select.innerHTML = '<option value="">Selecione uma categoria...</option>';

        try {
          const result = await window.electronAPI.findAllCategories(deps.Session.getToken());
          const categories = Array.isArray(result) ? result : (result?.data || []);

          // Update local categories cache
          this.categories = categories;

          for (const cat of categories) {
            const opt = document.createElement('option');
            opt.value = String(cat.id);
            opt.textContent = cat.name;
            select.appendChild(opt);
          }
        } catch (error) {
          console.error('Failed to load categories into select:', error);
        }
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
        const price = parseFloat(document.getElementById('product-price').value) || 0;
        const stock = parseInt(document.getElementById('product-stock').value) || 0;
        const unit = document.getElementById('product-unit').value;

        // Build metadata based on category config
        let data = { unit };
        if (categoryId) {
          const category = this.categories.find(c => c.id === categoryId);
          if (category && category.config && category.config.fields) {
            for (const field of category.config.fields) {
              const el = document.getElementById(`field-${field.id}`);
              if (el) {
                let value = el.value;
                if (field.type === 'number') {
                  value = value === '' ? null : parseFloat(value);
                  if (Number.isNaN(value)) value = null;
                }
                data[field.id] = value;
              }
            }
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

      async openCsvImportModal() {
        document.getElementById('csv-text-input').value = '';
        document.getElementById('csv-file-input').value = '';
        const resultDiv = document.getElementById('csv-import-result');
        resultDiv.style.display = 'none';
        resultDiv.textContent = '';

        // Load categories dynamically into CSV modal
        await this.loadCategoriesIntoCsvModal();

        deps.Modal.open('csv-import-modal');
      },

      async loadCategoriesIntoCsvModal() {
        const list = document.getElementById('csv-category-list');
        if (!list) return;

        list.innerHTML = '<li>Carregando categorias...</li>';

        try {
          const result = await window.electronAPI.findAllCategories(deps.Session.getToken());
          const categories = Array.isArray(result) ? result : (result?.data || []);

          list.innerHTML = '';
          if (categories.length === 0) {
            list.innerHTML = '<li>Nenhuma categoria encontrada</li>';
            return;
          }

          for (const cat of categories) {
            const li = document.createElement('li');
            li.innerHTML = `<code>${cat.id}</code> — ${cat.name}`;
            list.appendChild(li);
          }
        } catch (error) {
          console.error('Failed to load categories for CSV modal:', error);
          list.innerHTML = '<li>Erro ao carregar categorias</li>';
        }
      },

      readCsvFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          document.getElementById('csv-text-input').value = e.target.result;
        };
        reader.readAsText(file);
      },

      async downloadCsvTemplate() {
        // Build template with actual categories from the database
        let template = 'sku,name,category_id,price,stock,unit,description\n';

        try {
          const result = await window.electronAPI.findAllCategories(deps.Session.getToken());
          const categories = Array.isArray(result) ? result : (result?.data || []);

          for (const cat of categories) {
            const unit = cat.config?.unit || 'unidade';
            template += `sku-${cat.id},Exemplo ${cat.name},${cat.id},0.00,10,${unit},Descrição do produto\n`;
          }
        } catch (error) {
          console.error('Failed to load categories for template:', error);
          // Fallback minimal template
          template += 'SKU001,Produto A,1,10.00,50,unidade,Descrição\n';
        }

        const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'template_produtos_tana.csv';
        link.click();
        URL.revokeObjectURL(link.href);
        deps.Toast.success('Template baixado!');
      },

      async importCsv() {
        const csvData = document.getElementById('csv-text-input').value.trim();
        if (!csvData) {
          deps.Toast.warning('Cole ou carregue um arquivo CSV primeiro');
          return;
        }

        const resultDiv = document.getElementById('csv-import-result');
        resultDiv.style.display = 'block';
        resultDiv.style.background = 'var(--info)';
        resultDiv.style.color = 'white';
        resultDiv.textContent = 'Importando...';

        try {
          const result = await window.electronAPI.bulkCreateProducts(deps.Session.getToken(), csvData);
          if (result.success) {
            resultDiv.style.background = 'var(--success)';
            resultDiv.style.color = 'white';
            resultDiv.textContent = result.message;
            deps.Toast.success(result.message);
            if (result.errors.length > 0) {
              console.warn('CSV import errors:', result.errors);
            }
            await this.load();
            deps.POS.loadProducts();
            setTimeout(() => deps.Modal.close('csv-import-modal'), 1500);
          } else {
            resultDiv.style.background = 'var(--danger)';
            resultDiv.style.color = 'white';
            resultDiv.textContent = result.message;
            deps.Toast.error(result.message);
          }
        } catch (error) {
          resultDiv.style.background = 'var(--danger)';
          resultDiv.style.color = 'white';
          resultDiv.textContent = 'Erro na importação';
          deps.Toast.error('Erro na importação: ' + (error.message || error));
        }
      },
    },
  };
}
