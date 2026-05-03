import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Script starting...');
console.log('[Preload] contextBridge available:', !!contextBridge);
console.log('[Preload] ipcRenderer available:', !!ipcRenderer);

try {
  // Expose protected methods that allow the renderer process to use
  // a limited set of IPC methods
  contextBridge.exposeInMainWorld('electronAPI', {
    // Auth
    login: (credentials: { username: string; password: string }) => 
      ipcRenderer.invoke('auth:login', credentials),
    resetAdminUser: () => ipcRenderer.invoke('auth:resetAdmin'),
    createCashierUser: (username: string, password: string) => 
      ipcRenderer.invoke('auth:createCashier', username, password),
    listUsers: () => ipcRenderer.invoke('auth:listUsers'),
    deleteUser: (userId: number) => ipcRenderer.invoke('auth:deleteUser', userId),

  // Products
  findAllProducts: () => ipcRenderer.invoke('product:findAll'),
  findProductById: (id: number) => ipcRenderer.invoke('product:findById', id),
  findProductBySku: (sku: string) => ipcRenderer.invoke('product:findBySku', sku),
  findProductsByCategory: (categoryId: number) => ipcRenderer.invoke('product:findByCategory', categoryId),
  searchProducts: (query: string) => ipcRenderer.invoke('product:search', query),
  createProduct: (product: any) => ipcRenderer.invoke('product:create', product),
  updateProduct: (id: number, updates: any) => ipcRenderer.invoke('product:update', id, updates),
  deleteProduct: (id: number) => ipcRenderer.invoke('product:delete', id),
  getLowStockProducts: (threshold?: number) => ipcRenderer.invoke('product:getLowStock', threshold),
  getOutOfStockProducts: () => ipcRenderer.invoke('product:getOutOfStock'),

  // Sales
  createSale: (items: any[], paymentMethod: string) => ipcRenderer.invoke('sale:create', items, paymentMethod),
  findRecentSales: (limit?: number) => ipcRenderer.invoke('sale:findRecent', limit),
  findSalesByDate: (startDate: string, endDate: string) => ipcRenderer.invoke('sale:findSalesByDate', startDate, endDate),
  getSalesReport: (startDate?: string, endDate?: string) => ipcRenderer.invoke('sale:getReport', startDate, endDate),
  getTodaySales: () => ipcRenderer.invoke('sale:getTodaySales'),
  getTodayRevenue: () => ipcRenderer.invoke('sale:getTodayRevenue'),

  // Categories
  findAllCategories: () => ipcRenderer.invoke('category:findAll'),
  findCategoryById: (id: number) => ipcRenderer.invoke('category:findById', id),
  createCategory: (category: any) => ipcRenderer.invoke('category:create', category),
  updateCategory: (id: number, updates: any) => ipcRenderer.invoke('category:update', id, updates),
  deleteCategory: (id: number) => ipcRenderer.invoke('category:delete', id),
});

  console.log('[Preload] electronAPI exposed successfully');
} catch (err) {
  console.error('[Preload] Failed to expose electronAPI:', err);
}
