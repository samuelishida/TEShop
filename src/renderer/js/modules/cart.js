'use strict';

/**
 * @param {{ Utils: object }} deps
 */
export function createCartModule(deps) {
  return {
    Cart: {
      items: [],

      add(product, qty = 1) {
        const existing = this.items.find(item => item.product.id === product.id);

        if (existing) {
          if (existing.qty + qty > product.stock) {
            deps.Toast.warning('Estoque insuficiente!');
            return false;
          }
          existing.qty += qty;
          existing.total = existing.qty * existing.price;
        } else {
          if (qty > product.stock) {
            deps.Toast.warning('Estoque insuficiente!');
            return false;
          }
          this.items.push({
            product: product,
            qty: qty,
            price: product.price,
            total: qty * product.price,
          });
        }

        this.render();
        return true;
      },

      remove(productId) {
        this.items = this.items.filter(item => item.product.id !== productId);
        this.render();
      },

      updateQty(productId, qty) {
        const item = this.items.find(i => i.product.id === productId);
        if (!item) return;

        if (qty <= 0) {
          this.remove(productId);
          return;
        }

        if (qty > item.product.stock) {
          deps.Toast.warning('Estoque insuficiente!');
          return;
        }

        item.qty = qty;
        item.total = item.qty * item.price;
        this.render();
      },

      clear() {
        this.items = [];
        this.render();
      },

      getTotal() {
        return this.items.reduce((sum, item) => sum + item.total, 0);
      },

      increaseQty(productId) {
        const item = this.items.find(i => i.product.id === productId);
        if (item) this.updateQty(productId, item.qty + 1);
      },

      decreaseQty(productId) {
        const item = this.items.find(i => i.product.id === productId);
        if (item) this.updateQty(productId, item.qty - 1);
      },

      render() {
        const container = document.getElementById('cart-items');
        const totalElement = document.getElementById('cart-total-value');

        if (!container) return;

        container.textContent = '';

        if (this.items.length === 0) {
          const empty = document.createElement('div');
          empty.className = 'empty-state';
          const icon = document.createElement('div');
          icon.className = 'empty-state-icon';
          icon.textContent = '🛒';
          const text = document.createElement('div');
          text.className = 'empty-state-text';
          text.textContent = 'Carrinho vazio';
          empty.appendChild(icon);
          empty.appendChild(text);
          container.appendChild(empty);
        } else {
          for (const item of this.items) {
            const div = document.createElement('div');
            div.className = 'cart-item';
            div.dataset.id = item.product.id;

            const info = document.createElement('div');
            info.className = 'cart-item-info';

            const name = document.createElement('div');
            name.className = 'cart-item-name';
            name.textContent = item.product.name;

            const price = document.createElement('div');
            price.className = 'cart-item-price';
            price.textContent = deps.Utils.formatCurrency(item.price) + ' un.';

            info.appendChild(name);
            info.appendChild(price);

            const qty = document.createElement('div');
            qty.className = 'cart-item-qty';

            const btnMinus = document.createElement('button');
            btnMinus.textContent = '−';
            btnMinus.onclick = () => deps.Cart.decreaseQty(item.product.id);

            const qtySpan = document.createElement('span');
            qtySpan.textContent = String(item.qty);

            const btnPlus = document.createElement('button');
            btnPlus.textContent = '+';
            btnPlus.onclick = () => deps.Cart.increaseQty(item.product.id);

            qty.appendChild(btnMinus);
            qty.appendChild(qtySpan);
            qty.appendChild(btnPlus);

            const total = document.createElement('div');
            total.className = 'cart-item-total';
            total.textContent = deps.Utils.formatCurrency(item.total);

            const remove = document.createElement('button');
            remove.className = 'cart-item-remove';
            remove.textContent = '🗑️';
            remove.onclick = () => deps.Cart.remove(item.product.id);

            div.appendChild(info);
            div.appendChild(qty);
            div.appendChild(total);
            div.appendChild(remove);
            container.appendChild(div);
          }
        }

        if (totalElement) {
          totalElement.textContent = deps.Utils.formatCurrency(this.getTotal());
        }
      },
    },
  };
}
