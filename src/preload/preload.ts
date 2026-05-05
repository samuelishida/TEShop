import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Script starting...');
console.log('[Preload] contextBridge available:', !!contextBridge);
console.log('[Preload] ipcRenderer available:', !!ipcRenderer);

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    // Auth (public — no token required)
    login: (credentials: { username: string; password: string }) =>
      ipcRenderer.invoke('auth:login', credentials),
    logout: (token: string) => ipcRenderer.invoke('auth:logout', token),
    validateToken: (token: string) => ipcRenderer.invoke('auth:validate', token),
    resetAdminUser: () => ipcRenderer.invoke('auth:resetAdmin'),

    // Auth (protected — token required)
    createCashierUser: (token: string, username: string, password: string) =>
      ipcRenderer.invoke('auth:createCashier', token, username, password),
    createUser: (token: string, username: string, password: string, role: string) =>
      ipcRenderer.invoke('auth:createUser', token, username, password, role),
    changePassword: (token: string, oldPassword: string, newPassword: string) =>
      ipcRenderer.invoke('auth:changePassword', token, oldPassword, newPassword),
    listUsers: (token: string) =>
      ipcRenderer.invoke('auth:listUsers', token),
    deleteUser: (token: string, userId: number) =>
      ipcRenderer.invoke('auth:deleteUser', token, userId),

    // Products (protected — token required)
    findAllProducts: (token: string, options?: any) =>
      ipcRenderer.invoke('product:findAll', token, options),
    findProductById: (token: string, id: number) =>
      ipcRenderer.invoke('product:findById', token, id),
    findProductBySku: (token: string, sku: string) =>
      ipcRenderer.invoke('product:findBySku', token, sku),
    findProductsByCategory: (token: string, categoryId: number, options?: any) =>
      ipcRenderer.invoke('product:findByCategory', token, categoryId, options),
    searchProducts: (token: string, query: string, options?: any) =>
      ipcRenderer.invoke('product:search', token, query, options),
    createProduct: (token: string, product: any) =>
      ipcRenderer.invoke('product:create', token, product),
    updateProduct: (token: string, id: number, updates: any) =>
      ipcRenderer.invoke('product:update', token, id, updates),
    deleteProduct: (token: string, id: number) =>
      ipcRenderer.invoke('product:delete', token, id),
    bulkCreateProducts: (token: string, csvData: string) =>
      ipcRenderer.invoke('product:bulkCreate', token, csvData),
    getLowStockProducts: (token: string, threshold?: number) =>
      ipcRenderer.invoke('product:getLowStock', token, threshold),
    getOutOfStockProducts: (token: string) =>
      ipcRenderer.invoke('product:getOutOfStock', token),

    // Sales (protected — token required)
    createSale: (token: string, items: any[], paymentMethod: string) =>
      ipcRenderer.invoke('sale:create', token, items, paymentMethod),
    findRecentSales: (token: string, options?: any) =>
      ipcRenderer.invoke('sale:findRecent', token, options),
    findSalesByDate: (token: string, startDate: string, endDate: string, options?: any) =>
      ipcRenderer.invoke('sale:findSalesByDate', token, startDate, endDate, options),
    getSalesReport: (token: string, startDate?: string, endDate?: string) =>
      ipcRenderer.invoke('sale:getReport', token, startDate, endDate),
    getTodaySales: (token: string) =>
      ipcRenderer.invoke('sale:getTodaySales', token),
    getTodayRevenue: (token: string) =>
      ipcRenderer.invoke('sale:getTodayRevenue', token),
    cancelSale: (token: string, saleId: number) =>
      ipcRenderer.invoke('sale:cancel', token, saleId),

    // Categories (protected — token required)
    findAllCategories: (token: string, options?: any) =>
      ipcRenderer.invoke('category:findAll', token, options),
    findCategoryById: (token: string, id: number) =>
      ipcRenderer.invoke('category:findById', token, id),
    createCategory: (token: string, category: any) =>
      ipcRenderer.invoke('category:create', token, category),
    updateCategory: (token: string, id: number, updates: any) =>
      ipcRenderer.invoke('category:update', token, id, updates),
    deleteCategory: (token: string, id: number) =>
      ipcRenderer.invoke('category:delete', token, id),

    // Sync (protected — token required)
    startSyncServer: (token: string) =>
      ipcRenderer.invoke('sync:startServer', token),
    stopSyncServer: (token: string) =>
      ipcRenderer.invoke('sync:stopServer', token),
    isSyncHost: (token: string) =>
      ipcRenderer.invoke('sync:isHost', token),
    startSyncClient: (token: string, address: string) =>
      ipcRenderer.invoke('sync:startClient', token, address),
    stopSyncClient: (token: string) =>
      ipcRenderer.invoke('sync:stopClient', token),
    pullSync: (token: string, address: string) =>
      ipcRenderer.invoke('sync:pullOnce', token, address),
    getSyncHostAddress: (token: string) =>
      ipcRenderer.invoke('sync:getHostAddress', token),
    saveSyncHostAddress: (token: string, address: string) =>
      ipcRenderer.invoke('sync:saveHostAddress', token, address),
    checkSyncHost: (token: string, address: string) =>
      ipcRenderer.invoke('sync:checkHost', token, address),
  });

  console.log('[Preload] electronAPI exposed successfully');
} catch (err) {
  console.error('[Preload] Failed to expose electronAPI:', err);
}
