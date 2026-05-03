import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import { runMigrations } from '../database/connection';
import { ProductService } from '../services/product.service';
import { SaleService } from '../services/sale.service';
import { CategoryService } from '../services/category.service';
import { AuthService } from '../services/auth.service';
import { Product, SaleItem, LoginRequest } from '../types';

let mainWindow: BrowserWindow | null = null;

async function createWindow() {
  const preloadPath = join(__dirname, '../preload/preload.js');
  console.log('[Main] Preload path:', preloadPath);

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
function setupIPC() {
  const productService = new ProductService();
  const saleService = new SaleService();
  const categoryService = new CategoryService();
  const authService = new AuthService();

  // Auth
  ipcMain.handle('auth:login', async (_event, credentials: LoginRequest) => {
    return authService.login(credentials);
  });

  ipcMain.handle('auth:resetAdmin', async () => {
    return authService.resetAdminUser();
  });

  ipcMain.handle('auth:createCashier', async (_event, username: string, password: string) => {
    return authService.createCashierUser(username, password);
  });

  ipcMain.handle('auth:listUsers', async () => {
    return authService.listUsers();
  });

  ipcMain.handle('auth:deleteUser', async (_event, userId: number) => {
    return authService.deleteUser(userId);
  });

  // Products
  ipcMain.handle('product:findAll', async () => {
    return productService.findAll();
  });

  ipcMain.handle('product:findById', async (_event, id: number) => {
    return productService.findById(id);
  });

  ipcMain.handle('product:findBySku', async (_event, sku: string) => {
    return productService.findBySku(sku);
  });

  ipcMain.handle('product:findByCategory', async (_event, categoryId: number) => {
    return productService.findByCategory(categoryId);
  });

  ipcMain.handle('product:search', async (_event, query: string) => {
    return productService.search(query);
  });

  ipcMain.handle('product:create', async (_event, product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    return productService.create(product);
  });

  ipcMain.handle('product:update', async (_event, id: number, updates: Partial<Product>) => {
    return productService.update(id, updates);
  });

  ipcMain.handle('product:delete', async (_event, id: number) => {
    return productService.delete(id);
  });

  ipcMain.handle('product:getLowStock', async (_event, threshold?: number) => {
    return productService.getLowStock(threshold);
  });

  ipcMain.handle('product:getOutOfStock', async () => {
    return productService.getOutOfStock();
  });

  // Sales
  ipcMain.handle('sale:create', async (_event, items: Omit<SaleItem, 'total'>[], paymentMethod: string) => {
    return saleService.createSale(items, paymentMethod);
  });

  ipcMain.handle('sale:findRecent', async (_event, limit?: number) => {
    return saleService.findRecentSales(limit);
  });

  ipcMain.handle('sale:findSalesByDate', async (_event, startDate: string, endDate: string) => {
    return saleService.findSalesByDate(startDate, endDate);
  });

  ipcMain.handle('sale:getReport', async (_event, startDate?: string, endDate?: string) => {
    return saleService.getReport(startDate, endDate);
  });

  ipcMain.handle('sale:getTodaySales', async () => {
    return saleService.getTodaySales();
  });

  ipcMain.handle('sale:getTodayRevenue', async () => {
    return saleService.getTodayRevenue();
  });

  // Categories
  ipcMain.handle('category:findAll', async () => {
    return categoryService.findAll();
  });

  ipcMain.handle('category:findById', async (_event, id: number) => {
    return categoryService.findById(id);
  });

  ipcMain.handle('category:create', async (_event, category: any) => {
    return categoryService.create(category);
  });

  ipcMain.handle('category:update', async (_event, id: number, updates: any) => {
    return categoryService.update(id, updates);
  });

  ipcMain.handle('category:delete', async (_event, id: number) => {
    return categoryService.delete(id);
  });
}

app.whenReady().then(async () => {
  await runMigrations();
  setupIPC();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  // Close database connection
});
