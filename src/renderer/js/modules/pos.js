'use strict';

/**
 * @param {{ Toast: object, Utils: object, Cart: object, Session: object, Dashboard: object }} deps
 */
export function createPOSModule(deps) {
  return {
    POS: {
      products: [],
      categories: [],
      filteredProducts: [],

      async init() {
        // Only attach event listeners — data is loaded when navigating to POS page
        const searchInput = document.getElementById('pos-search');
        if (searchInput) searchInput.addEventListener('input', deps.Utils.debounce(async (e) => {
          const query = e.target.value.trim();

          try {
            if (query.length >= 6) {
              const product = await window.electronAPI.findProductBySku(deps.Session.getToken(), query);
              // findProductBySku returns the product object or null — check for actual product data
              if (product && product.id) {
                deps.Cart.add(product);
                searchInput.value = '';
                return;
              }
            }

            if (query) {
              const results = await window.electronAPI.searchProducts(deps.Session.getToken(), query);
              this.filteredProducts = Array.isArray(results) ? results : (results?.data || []);
            } else {
              const categoryId = document.getElementById('pos-category-filter')?.value;
              this.filteredProducts = categoryId
                ? this.products.filter(p => p.category_id === parseInt(categoryId))
                : [...this.products];
            }

            this.renderProducts();
          } catch (err) {
            console.error('POS search error:', err);
          }
        }, 200));

        const catFilter = document.getElementById('pos-category-filter');
        if (catFilter) catFilter.addEventListener('change', (e) => {
          const categoryId = e.target.value;
          this.filteredProducts = categoryId
            ? this.products.filter(p => p.category_id === parseInt(categoryId))
            : [...this.products];
          this.renderProducts();
        });

        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) checkoutBtn.addEventListener('click', () => this.checkout());

        const clearBtn = document.getElementById('clear-cart-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => {
          if (deps.Cart.items.length === 0) return;
          if (confirm('Limpar todos os itens do carrinho?')) {
            deps.Cart.clear();
          }
        });
      },

      async loadCategories() {
        try {
          const result = await window.electronAPI.findAllCategories(deps.Session.getToken());
          const categories = Array.isArray(result) ? result : (result?.data || []);
          if (categories.length === 0 && result?.error) {
            deps.Toast.error(result.error);
            return;
          }
          this.categories = categories;
          const select = document.getElementById('pos-category-filter');
          select.textContent = '';
          const allOpt = document.createElement('option');
          allOpt.value = '';
          allOpt.textContent = 'Todas categorias';
          select.appendChild(allOpt);
          for (const cat of this.categories) {
            const opt = document.createElement('option');
            opt.value = String(cat.id);
            opt.textContent = cat.name;
            select.appendChild(opt);
          }
        } catch (error) {
          console.error('Load categories error:', error);
          deps.Toast.error('Erro ao carregar categorias');
        }
      },

      async loadProducts() {
        await this.loadCategories();
        try {
          const result = await window.electronAPI.findAllProducts(deps.Session.getToken());
          const products = Array.isArray(result) ? result : (result?.data || []);
          if (products.length === 0 && result?.error) {
            deps.Toast.error(result.error);
            return;
          }
          this.products = products;
          this.filteredProducts = [...this.products];
          this.renderProducts();
        } catch (error) {
          console.error('Load products error:', error);
          deps.Toast.error('Erro ao carregar produtos');
        }
      },

      renderProducts() {
        const grid = document.getElementById('pos-products-grid');
        if (!grid) return;

        grid.textContent = '';

        if (this.filteredProducts.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          empty.style.gridColumn = '1 / -1';
          const icon = document.createElement('div');
          icon.className = 'empty-state-icon';
          icon.textContent = '📦';
          const text = document.createElement('div');
          text.className = 'empty-state-text';
          text.textContent = 'Nenhum produto encontrado';
          empty.appendChild(icon);
          empty.appendChild(text);
          grid.appendChild(empty);
          return;
        }

        for (const product of this.filteredProducts) {
          const isService = product.data?.unit === 'servico' || product.data?.type === 'banho-tosa';
          if (!isService && product.stock <= 0) continue;

          const card = document.createElement('div');
          card.className = 'product-card';
          card.onclick = () => this.addToCart(product.id);

          const name = document.createElement('div');
          name.className = 'product-name';
          name.textContent = product.name;

          const sku = document.createElement('div');
          sku.className = 'product-sku';
          sku.textContent = product.sku;

          const price = document.createElement('div');
          price.className = 'product-price';
          price.textContent = deps.Utils.formatCurrency(product.price);

          card.appendChild(name);
          card.appendChild(sku);
          card.appendChild(price);

          if (!isService) {
            const stock = document.createElement('div');
            stock.className = 'product-stock';
            stock.textContent = 'Estoque: ' + product.stock;
            if (product.stock === 0) stock.classList.add('out');
            else if (product.stock <= 10) stock.classList.add('low');
            card.appendChild(stock);
          }

          grid.appendChild(card);
        }
      },

      addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        const isService = product?.data?.unit === 'servico' || product?.data?.type === 'banho-tosa';
        if (product && (isService || product.stock > 0)) {
          deps.Cart.add(product);
        } else {
          deps.Toast.warning('Produto sem estoque!');
        }
      },

      async checkout() {
        if (deps.Cart.items.length === 0) {
          deps.Toast.warning('Carrinho vazio!');
          return;
        }

        const paymentMethod = document.getElementById('payment-method').value;

        try {
          const items = deps.Cart.items.map(item => ({
            product_id: item.product.id,
            quantity: item.qty,
            unit_price: item.price,
          }));

          const sale = await window.electronAPI.createSale(deps.Session.getToken(), items, paymentMethod);

          if (sale && sale.id) {
            deps.Toast.success(`Venda #${sale.id} finalizada com sucesso!`);
            deps.Cart.clear();
            await this.loadProducts();
            deps.Dashboard.load();
          } else {
            deps.Toast.error('Erro ao finalizar venda. Verifique o estoque e tente novamente.');
          }
        } catch (error) {
          console.error('Checkout error:', error);
          deps.Toast.error('Erro ao finalizar venda: ' + (error.message || error));
        }
      },
    },
  };
}
