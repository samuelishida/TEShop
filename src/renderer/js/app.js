// ============================================
// E-Shop PDV - Main Application Script
// Sistema de PDV e Gestão de Estoque
// ============================================

'use strict';

// --- Utility Functions ---
export const Utils = {
  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  },

  formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR');
  },

  formatDateTime(date) {
    return new Date(date).toLocaleString('pt-BR');
  },

  formatTime(date) {
    return new Date(date).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  },

  getToday() {
    return new Date().toISOString().split('T')[0];
  },

  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },
};

// --- Toast Notification System ---
export const Toast = {
  container: null,

  init() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 3000) {
    if (!this.container) this.init();

    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, duration);
  },

  success(message) {
    this.show(message, 'success');
  },

  error(message) {
    this.show(message, 'error');
  },

  warning(message) {
    this.show(message, 'warning');
  },
};

// --- Modal System ---
export const Modal = {
  open(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  },

  close(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  },

  closeAll() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.style.display = 'none';
      modal.classList.remove('active');
    });
  },
};

// --- Cart Manager ---
export const Cart = {
  items: [],

  add(product, qty = 1) {
    const existing = this.items.find(item => item.product.id === product.id);

    if (existing) {
      if (existing.qty + qty > product.stock) {
        Toast.warning('Estoque insuficiente!');
        return false;
      }
      existing.qty += qty;
      existing.total = existing.qty * existing.price;
    } else {
      if (qty > product.stock) {
        Toast.warning('Estoque insuficiente!');
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
      Toast.warning('Estoque insuficiente!');
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

  render() {
    const container = document.getElementById('cart-items');
    const totalElement = document.getElementById('cart-total-value');

    if (!container) return;

    if (this.items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🛒</div>
          <div class="empty-state-text">Carrinho vazio</div>
        </div>
      `;
    } else {
      container.innerHTML = this.items.map(item => `
        <div class="cart-item" data-id="${item.product.id}">
          <div class="cart-item-info">
            <div class="cart-item-name">${item.product.name}</div>
            <div class="cart-item-price">${Utils.formatCurrency(item.price)} un.</div>
          </div>
          <div class="cart-item-qty">
            <button onclick="Cart.decreaseQty(${item.product.id})">−</button>
            <span>${item.qty}</span>
            <button onclick="Cart.increaseQty(${item.product.id})">+</button>
          </div>
          <div class="cart-item-total">${Utils.formatCurrency(item.total)}</div>
          <button class="cart-item-remove" onclick="Cart.remove(${item.product.id})">🗑️</button>
        </div>
      `).join('');
    }

    if (totalElement) {
      totalElement.textContent = Utils.formatCurrency(this.getTotal());
    }
  },

  increaseQty(productId) {
    const item = this.items.find(i => i.product.id === productId);
    if (item) this.updateQty(productId, item.qty + 1);
  },

  decreaseQty(productId) {
    const item = this.items.find(i => i.product.id === productId);
    if (item) this.updateQty(productId, item.qty - 1);
  },
};

// --- Navigation Manager ---
export const Navigation = {
  currentPage: 'dashboard',

  init() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const page = item.dataset.page;
        this.goTo(page);
      });
    });
  },

  goTo(page) {
    this.currentPage = page;

    // Update nav active state
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Show/hide pages
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `${page}-page`);
    });

    // Load page data
    switch (page) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'pos':
        POS.loadProducts();
        break;
      case 'products':
        Products.load();
        break;
      case 'categories':
        Categories.load();
        break;
      case 'reports':
        Reports.setDefaultDates();
        break;
    }
  },
};

// --- Auth Manager ---
export const Auth = {
  currentUser: null,

  async login(username, password) {
    try {
      const result = await window.electronAPI.login({ username, password });
      if (result.success) {
        this.currentUser = result.user;
        document.getElementById('login-error').textContent = '';
        this.showApp();
        Toast.success(`Bem-vindo, ${username}!`);
        Dashboard.load();
        return true;
      } else {
        const msg = result.message || 'Credenciais inválidas';
        document.getElementById('login-error').textContent = msg;
        throw new Error(msg);
      }
    } catch (error) {
      const msg = error.message || 'Erro ao fazer login';
      document.getElementById('login-error').textContent = msg;
      Toast.error(msg);
      return false;
    }
  },

  showApp() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
  },

  logout() {
    this.currentUser = null;
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('login-form').reset();
    document.getElementById('login-error').textContent = '';
  },
};

// --- Dashboard Manager ---
export const Dashboard = {
  async load() {
    try {
      // Load today's revenue
      const revenue = await window.electronAPI.getTodayRevenue();
      document.getElementById('today-revenue').textContent = Utils.formatCurrency(revenue);

      // Load today's sales count
      const todaySales = await window.electronAPI.getTodaySales();
      document.getElementById('today-sales-count').textContent = todaySales.length;

      // Load total products
      const products = await window.electronAPI.findAllProducts();
      document.getElementById('total-products').textContent = products.length;

      // Load low stock count
      const lowStock = await window.electronAPI.getLowStockProducts(10);
      document.getElementById('low-stock-count').textContent = lowStock.length;

      // Load recent sales
      await this.loadRecentSales();
    } catch (error) {
      console.error('Dashboard load error:', error);
      Toast.error('Erro ao carregar dashboard');
    }
  },

  async loadRecentSales() {
    try {
      const sales = await window.electronAPI.findRecentSales(10);
      const tbody = document.querySelector('#recent-sales-table tbody');

      if (sales.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center;">Nenhuma venda recente</td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = sales.map(sale => `
        <tr>
          <td>#${sale.id}</td>
          <td>${sale.items.length} item(s)</td>
          <td>${Utils.formatCurrency(sale.total)}</td>
          <td>${this.getPaymentLabel(sale.payment_method)}</td>
          <td>${Utils.formatTime(sale.created_at)}</td>
        </tr>
      `).join('');
    } catch (error) {
      console.error('Recent sales load error:', error);
    }
  },

  getPaymentLabel(method) {
    const labels = {
      cash: 'Dinheiro',
      credit: 'Crédito',
      debit: 'Débito',
      pix: 'PIX',
    };
    return labels[method] || method;
  },
};

// --- POS (Point of Sale) Manager ---
export const POS = {
  products: [],
  categories: [],
  filteredProducts: [],

  async init() {
    await this.loadCategories();
    await this.loadProducts();

    // Search handler
    const searchInput = document.getElementById('pos-search');
    searchInput.addEventListener('input', Utils.debounce(async (e) => {
      const query = e.target.value.trim();

      // Check if it's a SKU/barcode (exact match)
      if (query.length >= 6) {
        const product = await window.electronAPI.findProductBySku(query);
        if (product) {
          Cart.add(product);
          searchInput.value = '';
          return;
        }
      }

      if (query) {
        const results = await window.electronAPI.searchProducts(query);
        this.filteredProducts = results;
      } else {
        const categoryId = document.getElementById('pos-category-filter').value;
        this.filteredProducts = categoryId
          ? this.products.filter(p => p.category_id === parseInt(categoryId))
          : [...this.products];
      }

      this.renderProducts();
    }, 200));

    // Category filter handler
    document.getElementById('pos-category-filter').addEventListener('change', (e) => {
      const categoryId = e.target.value;
      this.filteredProducts = categoryId
        ? this.products.filter(p => p.category_id === parseInt(categoryId))
        : [...this.products];
      this.renderProducts();
    });

    // Checkout handler
    document.getElementById('checkout-btn').addEventListener('click', () => this.checkout());

    // Clear cart handler
    document.getElementById('clear-cart-btn').addEventListener('click', () => {
      if (Cart.items.length === 0) return;
      if (confirm('Limpar todos os itens do carrinho?')) {
        Cart.clear();
      }
    });
  },

  async loadCategories() {
    try {
      this.categories = await window.electronAPI.findAllCategories();
      const select = document.getElementById('pos-category-filter');
      select.innerHTML = '<option value="">Todas categorias</option>';
      this.categories.forEach(cat => {
        select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      });
    } catch (error) {
      console.error('Load categories error:', error);
    }
  },

  async loadProducts() {
    try {
      this.products = await window.electronAPI.findAllProducts();
      this.filteredProducts = [...this.products];
      this.renderProducts();
    } catch (error) {
      console.error('Load products error:', error);
      Toast.error('Erro ao carregar produtos');
    }
  },

  renderProducts() {
    const grid = document.getElementById('pos-products-grid');

    if (this.filteredProducts.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📦</div>
          <div class="empty-state-text">Nenhum produto encontrado</div>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.filteredProducts
      .filter(p => p.stock > 0)
      .map(product => {
        const stockClass = product.stock === 0 ? 'out' : product.stock <= 10 ? 'low' : '';
        return `
          <div class="product-card" onclick="POS.addToCart(${product.id})">
            <div class="product-name">${product.name}</div>
            <div class="product-sku">${product.sku}</div>
            <div class="product-price">${Utils.formatCurrency(product.price)}</div>
            <div class="product-stock ${stockClass}">Estoque: ${product.stock}</div>
          </div>
        `;
      }).join('');
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (product && product.stock > 0) {
      Cart.add(product);
    } else {
      Toast.warning('Produto sem estoque!');
    }
  },

  async checkout() {
    if (Cart.items.length === 0) {
      Toast.warning('Carrinho vazio!');
      return;
    }

    const paymentMethod = document.getElementById('payment-method').value;

    try {
      const items = Cart.items.map(item => ({
        product_id: item.product.id,
        quantity: item.qty,
        price: item.price,
      }));

      const sale = await window.electronAPI.createSale(items, paymentMethod);

      if (sale) {
        Toast.success(`Venda #${sale.id} finalizada com sucesso!`);
        Cart.clear();
        await this.loadProducts(); // Refresh stock
        Dashboard.load(); // Refresh dashboard
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Toast.error('Erro ao finalizar venda: ' + (error.message || error));
    }
  },
};

// --- Products Manager ---
export const Products = {
  allProducts: [],
  categories: [],
  editingId: null,

  async init() {
    // Add product button
    document.getElementById('add-product-btn').addEventListener('click', () => {
      this.openProductModal();
    });

    // Product form submit
    document.getElementById('product-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveProduct();
    });

    // Product search
    document.getElementById('product-search').addEventListener('input', Utils.debounce((e) => {
      const query = e.target.value.toLowerCase();
      const filtered = this.allProducts.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.sku.toLowerCase().includes(query)
      );
      this.renderTable(filtered);
    }, 200));

    // Modal close buttons
    document.querySelector('#product-modal .modal-close').addEventListener('click', () => {
      Modal.close('product-modal');
    });
    document.querySelector('#product-modal .modal-cancel').addEventListener('click', () => {
      Modal.close('product-modal');
    });
  },

  async load() {
    try {
      this.allProducts = await window.electronAPI.findAllProducts();
      this.categories = await window.electronAPI.findAllCategories();
      this.renderTable(this.allProducts);
    } catch (error) {
      console.error('Load products error:', error);
      Toast.error('Erro ao carregar produtos');
    }
  },

  renderTable(products) {
    const tbody = document.querySelector('#products-table tbody');

    if (products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center;">Nenhum produto encontrado</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(product => {
      const category = this.categories.find(c => c.id === product.category_id);
      const stockBadge = product.stock === 0
        ? '<span class="badge badge-danger">Sem estoque</span>'
        : product.stock <= 10
          ? '<span class="badge badge-warning">Estoque baixo</span>'
          : '<span class="badge badge-success">OK</span>';

      return `
        <tr>
          <td>${product.sku}</td>
          <td>${product.name}</td>
          <td>${category ? category.name : '-'}</td>
          <td>${Utils.formatCurrency(product.price)}</td>
          <td>${product.stock} ${stockBadge}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="Products.edit(${product.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="Products.remove(${product.id})">🗑️</button>
          </td>
        </tr>
      `;
    }).join('');
  },

  async openProductModal(product = null) {
    this.editingId = product ? product.id : null;
    document.getElementById('product-modal-title').textContent = product ? 'Editar Produto' : 'Novo Produto';

    // Populate categories
    const select = document.getElementById('product-category');
    select.innerHTML = '<option value="">Selecione...</option>';
    this.categories.forEach(cat => {
      select.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
    });

    if (product) {
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-sku').value = product.sku;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-category').value = product.category_id;
      document.getElementById('product-price').value = product.price;
      document.getElementById('product-stock').value = product.stock;
      document.getElementById('product-data').value = product.data ? JSON.stringify(product.data, null, 2) : '';
    } else {
      document.getElementById('product-form').reset();
      document.getElementById('product-id').value = '';
    }

    Modal.open('product-modal');
  },

  edit(productId) {
    const product = this.allProducts.find(p => p.id === productId);
    if (product) {
      this.openProductModal(product);
    }
  },

  async saveProduct() {
    const id = document.getElementById('product-id').value;
    const sku = document.getElementById('product-sku').value.trim();
    const name = document.getElementById('product-name').value.trim();
    const categoryId = parseInt(document.getElementById('product-category').value);
    const price = parseFloat(document.getElementById('product-price').value);
    const stock = parseInt(document.getElementById('product-stock').value);
    const dataStr = document.getElementById('product-data').value.trim();

    let data = null;
    if (dataStr) {
      try {
        data = JSON.parse(dataStr);
      } catch {
        Toast.error('JSON inválido nos metadados');
        return;
      }
    }

    try {
      if (id) {
        // Update
        await window.electronAPI.updateProduct(parseInt(id), {
          sku, name, category_id: categoryId, price, stock, data,
        });
        Toast.success('Produto atualizado!');
      } else {
        // Create
        await window.electronAPI.createProduct({
          sku, name, category_id: categoryId, price, stock, data,
        });
        Toast.success('Produto criado!');
      }

      Modal.close('product-modal');
      await this.load();
      POS.loadProducts(); // Refresh POS products
    } catch (error) {
      console.error('Save product error:', error);
      Toast.error('Erro ao salvar produto: ' + (error.message || error));
    }
  },

  async remove(productId) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await window.electronAPI.deleteProduct(productId);
      Toast.success('Produto excluído!');
      await this.load();
      POS.loadProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      Toast.error('Erro ao excluir produto');
    }
  },
};

// --- Categories Manager ---
export const Categories = {
  allCategories: [],
  editingId: null,

  async init() {
    // Add category button
    document.getElementById('add-category-btn').addEventListener('click', () => {
      this.openCategoryModal();
    });

    // Category form submit
    document.getElementById('category-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCategory();
    });

    // Modal close buttons
    document.querySelector('#category-modal .modal-close').addEventListener('click', () => {
      Modal.close('category-modal');
    });
    document.querySelector('#category-modal .modal-cancel').addEventListener('click', () => {
      Modal.close('category-modal');
    });
  },

  async load() {
    try {
      this.allCategories = await window.electronAPI.findAllCategories();
      this.renderTable();
    } catch (error) {
      console.error('Load categories error:', error);
      Toast.error('Erro ao carregar categorias');
    }
  },

  renderTable() {
    const tbody = document.querySelector('#categories-table tbody');

    if (this.allCategories.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center;">Nenhuma categoria encontrada</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.allCategories.map(cat => `
      <tr>
        <td>${cat.name}</td>
        <td>${cat.description || '-'}</td>
        <td>
          <button class="btn btn-sm btn-outline" onclick="Categories.edit(${cat.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="Categories.remove(${cat.id})">🗑️</button>
        </td>
      </tr>
    `).join('');
  },

  openCategoryModal(category = null) {
    this.editingId = category ? category.id : null;
    document.getElementById('category-modal-title').textContent = category ? 'Editar Categoria' : 'Nova Categoria';

    if (category) {
      document.getElementById('category-id').value = category.id;
      document.getElementById('category-name').value = category.name;
      document.getElementById('category-description').value = category.description || '';
    } else {
      document.getElementById('category-form').reset();
      document.getElementById('category-id').value = '';
    }

    Modal.open('category-modal');
  },

  edit(categoryId) {
    const category = this.allCategories.find(c => c.id === categoryId);
    if (category) {
      this.openCategoryModal(category);
    }
  },

  async saveCategory() {
    const id = document.getElementById('category-id').value;
    const name = document.getElementById('category-name').value.trim();
    const description = document.getElementById('category-description').value.trim();

    try {
      if (id) {
        await window.electronAPI.updateCategory(parseInt(id), { name, description });
        Toast.success('Categoria atualizada!');
      } else {
        await window.electronAPI.createCategory({ name, description });
        Toast.success('Categoria criada!');
      }

      Modal.close('category-modal');
      await this.load();
      await POS.loadCategories(); // Refresh POS categories
    } catch (error) {
      console.error('Save category error:', error);
      Toast.error('Erro ao salvar categoria: ' + (error.message || error));
    }
  },

  async remove(categoryId) {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    try {
      await window.electronAPI.deleteCategory(categoryId);
      Toast.success('Categoria excluída!');
      await this.load();
      await POS.loadCategories();
    } catch (error) {
      console.error('Delete category error:', error);
      Toast.error('Erro ao excluir categoria');
    }
  },
};

// --- Reports Manager ---
export const Reports = {
  setDefaultDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    document.getElementById('report-start-date').value = firstDay.toISOString().split('T')[0];
    document.getElementById('report-end-date').value = today.toISOString().split('T')[0];
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
      Toast.warning('Selecione as datas');
      return;
    }

    try {
      const report = await window.electronAPI.getSalesReport(startDate, endDate);

      document.getElementById('report-total-sales').textContent = report.totalSales || 0;
      document.getElementById('report-total-revenue').textContent = Utils.formatCurrency(report.totalRevenue || 0);
      document.getElementById('report-daily-average').textContent = Utils.formatCurrency(report.dailyAverage || 0);

      // Top products
      const tbody = document.querySelector('#top-products-table tbody');
      if (report.topProducts && report.topProducts.length > 0) {
        tbody.innerHTML = report.topProducts.map(p => `
          <tr>
            <td>${p.product_name}</td>
            <td>${p.total_quantity}</td>
            <td>${Utils.formatCurrency(p.total_revenue)}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="3" style="text-align: center;">Nenhum produto vendido no período</td>
          </tr>
        `;
      }

      Toast.success('Relatório gerado!');
    } catch (error) {
      console.error('Generate report error:', error);
      Toast.error('Erro ao gerar relatório');
    }
  },
};

// --- App Initialization ---
export const App = {
  async init() {
    // Initialize Toast system
    Toast.init();

    // Login form handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      if (!username || !password) {
        Toast.warning('Preencha todos os campos');
        return;
      }

      await Auth.login(username, password);
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
      Auth.logout();
    });

    // Initialize managers
    Navigation.init();
    POS.init();
    Products.init();
    Categories.init();
    Reports.init();

    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay, .modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          Modal.close(modal.id);
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // ESC to close modals
      if (e.key === 'Escape') {
        Modal.closeAll();
      }
    });

    console.log('🐾 E-Shop PDV initialized');
  },
};

// Expose to window for inline onclick handlers
window.Cart = Cart;
window.POS = POS;
window.Products = Products;
window.Categories = Categories;
window.Reports = Reports;
window.Modal = Modal;
window.App = App;

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
