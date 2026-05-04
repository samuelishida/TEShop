'use strict';

/**
 * @param {{ Toast: object, Utils: object, Cart: object, Session: object }} deps
 */
export function createPOSModule(deps) {
  return {
    POS: {
      products: [],
      categories: [],
      filteredProducts: [],

      async init() {
        await this.loadCategories();
        await this.loadProducts();

        const searchInput = document.getElementById('pos-search');
        searchInput.addEventListener('input', deps.Utils.debounce(async (e) => {
          const query = e.target.value.trim();

          if (query.length >= 6) {
            const product = await window.electronAPI.findProductBySku(deps.Session.getToken(), query);
            if (product) {
              deps.Cart.add(product);
              searchInput.value = '';
              return;
            }
          }

          if (query) {
            const results = await window.electronAPI.searchProducts(deps.Session.getToken(), query);
            this.filteredProducts = results;
          } else {
            const categoryId = document.getElementById('pos-category-filter').value;
            this.filteredProducts = categoryId
              ? this.products.filter(p => p.category_id === parseInt(categoryId))
              : [...this.products];
          }

          this.renderProducts();
        }, 200));

        document.getElementById('pos-category-filter').addEventListener('change', (e) => {
          const categoryId = e.target.value;
          this.filteredProducts = categoryId
            ? this.products.filter(p => p.category_id === parseInt(categoryId))
            : [...this.products];
          this.renderProducts();
        });

        document.getElementById('checkout-btn').addEventListener('click', () => this.checkout());

        document.getElementById('clear-cart-btn').addEventListener('click', () => {
          if (deps.Cart.items.length === 0) return;
          if (confirm('Limpar todos os itens do carrinho?')) {
            deps.Cart.clear();
          }
        });
      },

      async loadCategories() {
        try {
          this.categories = await window.electronAPI.findAllCategories(deps.Session.getToken());
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
        }
      },

      async loadProducts() {
        try {
          this.products = await window.electronAPI.findAllProducts(deps.Session.getToken());
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
          if (product.stock <= 0) continue;

          const card = document.createElement('div');
          card.className = 'product-card';
          card.onclick = () => deps.POS.addToCart(product.id);

          const name = document.createElement('div');
          name.className = 'product-name';
          name.textContent = product.name;

          const sku = document.createElement('div');
          sku.className = 'product-sku';
          sku.textContent = product.sku;

          const price = document.createElement('div');
          price.className = 'product-price';
          price.textContent = deps.Utils.formatCurrency(product.price);

          const stock = document.createElement('div');
          stock.className = 'product-stock';
          stock.textContent = 'Estoque: ' + product.stock;
          if (product.stock === 0) stock.classList.add('out');
          else if (product.stock <= 10) stock.classList.add('low');

          card.appendChild(name);
          card.appendChild(sku);
          card.appendChild(price);
          card.appendChild(stock);
          grid.appendChild(card);
        }
      },

      addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (product && product.stock > 0) {
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

          if (sale) {
            deps.Toast.success(`Venda #${sale.id} finalizada com sucesso!`);
            deps.Cart.clear();
            await this.loadProducts();
            deps.Dashboard.load();
          }
        } catch (error) {
          console.error('Checkout error:', error);
          deps.Toast.error('Erro ao finalizar venda: ' + (error.message || error));
        }
      },
    },
  };
}
