// ============================================
// E-Shop PDV - Main Application
// ============================================

'use strict';

console.log('[App] Starting... electronAPI available:', !!window.electronAPI);

import { Utils } from './modules/utils.js';
import { createToastModule } from './modules/toast.js';
import { createModalModule } from './modules/modal.js';
import { createCartModule } from './modules/cart.js';
import { createDashboardModule } from './modules/dashboard.js';
import { createReportsModule } from './modules/reports.js';
import { createSyncModule } from './modules/sync.js';
import { createPOSModule } from './modules/pos.js';
import { createProductsModule } from './modules/products.js';
import { createCategoriesModule } from './modules/categories.js';
import { createNavigationModule } from './modules/navigation.js';
import { createUsersModule } from './modules/users.js';
import { createAuthModule } from './modules/auth.js';

// --- Shared instances ---
const { Toast } = createToastModule({});
const { Modal } = createModalModule({});
const Cart = createCartModule({ Utils, Toast }).Cart;

// --- Session management (must be before modules that depend on it) ---
const Session = {
  token: null,
  user: null,

  save(token, user) {
    this.token = token;
    this.user = user;
    try {
      localStorage.setItem('eshop_session_token', token);
      localStorage.setItem('eshop_session_user', JSON.stringify(user));
    } catch {}
  },

  load() {
    try {
      this.token = localStorage.getItem('eshop_session_token');
      const userStr = localStorage.getItem('eshop_session_user');
      if (userStr) this.user = JSON.parse(userStr);
    } catch {
      this.token = null;
      this.user = null;
    }
  },

  clear() {
    this.token = null;
    this.user = null;
    try {
      localStorage.removeItem('eshop_session_token');
      localStorage.removeItem('eshop_session_user');
    } catch {}
  },

  getToken() { return this.token; },
  getUser() { return this.user; },
};

const Dashboard = createDashboardModule({ Toast, Utils, Session }).Dashboard;
const SyncStatus = createSyncModule({ Toast, Session }).SyncStatus;
const Reports = createReportsModule({ Toast, Utils, Session }).Reports;

// --- Cross-refs: set these after creation ---
const POS = { loadCategories: () => {} };
const Categories = { loadCategories: () => {} };

// POS needs Cart, Cart needs nothing special
Object.assign(POS, createPOSModule({ Toast, Utils, Cart, Session, Dashboard }).POS);
Cart._POS = POS; // let Cart know about POS for sync

// Products needs Toast, Utils, Modal, Cart, Dashboard, SyncStatus, POS
const Products = createProductsModule({ Toast, Utils, Modal, Cart, Dashboard, SyncStatus, POS, Session }).Products;

// Categories needs Toast, Utils, Modal, POS
Object.assign(Categories, createCategoriesModule({ Toast, Utils, Modal, POS, Session }).Categories);

// Users (before Navigation, since Navigation references it)
const Users = createUsersModule({ Toast, Utils, Modal, Session }).Users;

// Navigation needs all page modules + Dashboard
const Navigation = createNavigationModule({ Toast, Utils, Cart, POS, Products, Categories, Reports, Users, Dashboard }).Navigation;

// Auth needs Navigation + SyncStatus + Session
const Auth = createAuthModule({ Toast, Utils, Cart, Dashboard, SyncStatus, Navigation, Session }).Auth;

// --- Restore existing session ---
Session.load();
if (Session.getToken() && Session.getUser()) {
  Auth.restoreSession(Session.getUser()).catch(() => {
    // Token invalid — already handled inside restoreSession (clears session)
  });
}

// --- Login ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  await Auth.login(username, password);
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await window.electronAPI.logout(Session.getToken());
  Session.clear();
  SyncStatus.destroy();
  Auth.logout();
  Cart.clear();
});

// --- Theme toggle ---
document.getElementById('theme-toggle').addEventListener('change', (e) => {
  const theme = e.target.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
});

// Restore saved theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.getElementById('theme-toggle').checked = true;
}

// --- Sync settings ---
document.getElementById('save-host-address-btn').addEventListener('click', () => {
  SyncStatus.saveHostAddress();
});

document.getElementById('manual-sync-btn').addEventListener('click', () => {
  SyncStatus.manualSync();
});

// --- Init all modules (attach event listeners) ---
try {
  Navigation.init();
  Products.init();
  POS.init();
  Categories.init();
  Users.init();
  Reports.init();
  console.log('[App] All modules initialized successfully');
} catch (err) {
  console.error('[App] Module init failed:', err);
}
Cart.render();
// Dashboard.load() is called after login/restoreSession — not here

// --- Prevent accidental navigation ---
window.addEventListener('beforeunload', (e) => {
  if (Cart.items.length > 0) {
    e.preventDefault();
    e.returnValue = 'Você tem itens no carrinho. Deseja sair mesmo assim?';
  }
});
