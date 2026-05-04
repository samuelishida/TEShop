import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'path';
import { networkInterfaces } from 'os';
import { runMigrations } from '../database/connection';
import { ProductService } from '../services/product.service';
import { SaleService } from '../services/sale.service';
import { CategoryService } from '../services/category.service';
import { AuthService } from '../services/auth.service';
import { syncService } from '../services/sync.service';
import { createLogger } from '../services/logger.service';
import { validate, ValidationError } from '../validation';
import {
  LoginSchema,
  ProductCreateSchema,
  ProductUpdateSchema,
  SaleCreateSchema,
  SaleFindByDateSchema,
  CategoryCreateSchema,
  CategoryUpdateSchema,
  CreateCashierSchema,
  IdSchema,
  PaginationSchema,
  LowStockSchema,
} from '../validation/schemas';

let mainWindow: BrowserWindow | null = null;

function getLocalIP(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

async function createWindow() {
  const preloadPath = join(__dirname, '../preload/preload.js');

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

const log = createLogger('IPC');

function safeHandler<T>(handler: () => T): T {
  try {
    return handler();
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message, fieldErrors: error.fieldErrors } as T;
    }
    log.error('IPC handler error', { error: String(error) });
    return { success: false, error: 'Erro interno do servidor' } as T;
  }
}

/**
 * Auth guard for IPC handlers.
 * Validates the token passed as the first argument (or in a dedicated field)
 * before allowing the handler to execute.
 * Returns { success: false, error: 'Não autenticado' } if token is missing/invalid.
 */
function requireAuth<T>(handler: (userId: number) => T): (token: unknown, ...rest: unknown[]) => T | { success: false; error: string } {
  return (token: unknown, ..._rest: unknown[]) => {
    if (typeof token !== 'string' || !token) {
      return { success: false, error: 'Não autenticado' };
    }
    const result = authService.validateToken(token);
    if (!result.valid || !result.userId) {
      return { success: false, error: 'Não autenticado' };
    }
    return safeHandler(() => handler(result.userId!));
  };
}

const authService = new AuthService();

function setupIPC() {
  const productService = new ProductService();
  const saleService = new SaleService();
  const categoryService = new CategoryService();

  // Auth
  ipcMain.handle('auth:login', async (_event, credentials: unknown) => {
    return safeHandler(() => {
      const data = validate(LoginSchema, credentials, 'auth:login');
      const result = authService.login(data);
      if (result.success && result.user && result.token) {
        if (result.user.role === 'admin') {
          const localIP = getLocalIP();
          const serverResult = syncService.startServer();
          // Save the sync token so cashiers can use it
          if (serverResult.token) {
            syncService.saveSyncToken(serverResult.token);
          }
          if (localIP) {
            syncService.saveHostState(true, localIP);
          }
        } else {
          const hostAddress = syncService.getHostAddress();
          const syncToken = syncService.getSyncToken();
          if (hostAddress) {
            syncService.startClient(hostAddress, syncToken || undefined);
          }
        }
      }
      return result;
    });
  });

  ipcMain.handle('auth:logout', async (_event, token: unknown) => {
    if (typeof token === 'string') {
      authService.logout(token);
    }
    return { success: true };
  });

  ipcMain.handle('auth:validate', async (_event, token: unknown) => {
    if (typeof token !== 'string') {
      return { valid: false };
    }
    return authService.validateToken(token);
  });

  ipcMain.handle('auth:resetAdmin', async () => {
    return safeHandler(() => authService.resetAdminUser());
  });

  // --- Protected handlers (requireAuth) ---

  ipcMain.handle('auth:createCashier', async (_event, token: unknown, username: unknown, password: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(CreateCashierSchema, { username, password }, 'auth:createCashier');
      return authService.createCashierUser(data.username, data.password);
    })(token, username, password);
  });

  ipcMain.handle('auth:listUsers', async (_event, token: unknown) => {
    return requireAuth((_userId) => authService.listUsers())(token);
  });

  ipcMain.handle('auth:deleteUser', async (_event, token: unknown, userId: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id: userId }, 'auth:deleteUser');
      return authService.deleteUser(data.id);
    })(token, userId);
  });

  // Products — paginated (protected)
  ipcMain.handle('product:findAll', async (_event, token: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const opts = options ? validate(PaginationSchema, options, 'product:findAll') : {};
      return productService.findAll(opts);
    })(token, options);
  });

  ipcMain.handle('product:findById', async (_event, token: unknown, id: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id }, 'product:findById');
      return productService.findById(data.id);
    })(token, id);
  });

  ipcMain.handle('product:findBySku', async (_event, token: unknown, sku: unknown) => {
    return requireAuth((_userId) => {
      if (typeof sku !== 'string' || !sku.trim()) {
        return { success: false, error: 'SKU inválido' };
      }
      return productService.findBySku(sku.trim());
    })(token, sku);
  });

  ipcMain.handle('product:findByCategory', async (_event, token: unknown, categoryId: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const idData = validate(IdSchema, { id: categoryId }, 'product:findByCategory');
      const opts = options ? validate(PaginationSchema, options, 'product:findByCategory') : {};
      return productService.findByCategory(idData.id, opts);
    })(token, categoryId, options);
  });

  ipcMain.handle('product:search', async (_event, token: unknown, query: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      if (typeof query !== 'string') {
        return { items: [], total: 0, limit: 100, offset: 0, hasMore: false };
      }
      const opts = options ? validate(PaginationSchema, options, 'product:search') : {};
      return productService.search(query, opts);
    })(token, query, options);
  });

  ipcMain.handle('product:create', async (_event, token: unknown, product: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(ProductCreateSchema, product, 'product:create');
      return productService.create(data);
    })(token, product);
  });

  ipcMain.handle('product:update', async (_event, token: unknown, id: unknown, updates: unknown) => {
    return requireAuth((_userId) => {
      const idData = validate(IdSchema, { id }, 'product:update');
      const updateData = validate(ProductUpdateSchema, updates, 'product:update');
      return productService.update(idData.id, updateData);
    })(token, id, updates);
  });

  ipcMain.handle('product:delete', async (_event, token: unknown, id: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id }, 'product:delete');
      return productService.delete(data.id);
    })(token, id);
  });

  ipcMain.handle('product:getLowStock', async (_event, token: unknown, threshold: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(LowStockSchema, { threshold }, 'product:getLowStock');
      return productService.getLowStock(data.threshold);
    })(token, threshold);
  });

  ipcMain.handle('product:getOutOfStock', async (_event, token: unknown) => {
    return requireAuth((_userId) => productService.getOutOfStock())(token);
  });

  // Sales — paginated (protected)
  ipcMain.handle('sale:create', async (_event, token: unknown, items: unknown, paymentMethod: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(SaleCreateSchema, { items, paymentMethod }, 'sale:create');
      return saleService.createSale(data.items, data.paymentMethod);
    })(token, items, paymentMethod);
  });

  ipcMain.handle('sale:findRecent', async (_event, token: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const opts = options ? validate(PaginationSchema, options, 'sale:findRecent') : {};
      return saleService.findRecentSales(opts);
    })(token, options);
  });

  ipcMain.handle('sale:findSalesByDate', async (_event, token: unknown, startDate: unknown, endDate: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const dateData = validate(SaleFindByDateSchema, { startDate, endDate }, 'sale:findSalesByDate');
      const opts = options ? validate(PaginationSchema, options, 'sale:findSalesByDate') : {};
      return saleService.findSalesByDate(dateData.startDate, dateData.endDate, opts);
    })(token, startDate, endDate, options);
  });

  ipcMain.handle('sale:getReport', async (_event, token: unknown, startDate?: unknown, endDate?: unknown) => {
    return requireAuth((_userId) =>
      saleService.getReport(
        typeof startDate === 'string' ? startDate : undefined,
        typeof endDate === 'string' ? endDate : undefined
      )
    )(token, startDate, endDate);
  });

  ipcMain.handle('sale:getTodaySales', async (_event, token: unknown) => {
    return requireAuth((_userId) => saleService.getTodaySales())(token);
  });

  ipcMain.handle('sale:getTodayRevenue', async (_event, token: unknown) => {
    return requireAuth((_userId) => saleService.getTodayRevenue())(token);
  });

  ipcMain.handle('sale:cancel', async (_event, token: unknown, saleId: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id: saleId }, 'sale:cancel');
      return saleService.cancelSale(data.id);
    })(token, saleId);
  });

  // Categories — paginated (protected)
  ipcMain.handle('category:findAll', async (_event, token: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const opts = options ? validate(PaginationSchema, options, 'category:findAll') : {};
      return categoryService.findAll(opts);
    })(token, options);
  });

  ipcMain.handle('category:findById', async (_event, token: unknown, id: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id }, 'category:findById');
      return categoryService.findById(data.id);
    })(token, id);
  });

  ipcMain.handle('category:create', async (_event, token: unknown, category: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(CategoryCreateSchema, category, 'category:create');
      return categoryService.create(data);
    })(token, category);
  });

  ipcMain.handle('category:update', async (_event, token: unknown, id: unknown, updates: unknown) => {
    return requireAuth((_userId) => {
      const idData = validate(IdSchema, { id }, 'category:update');
      const updateData = validate(CategoryUpdateSchema, updates, 'category:update');
      return categoryService.update(idData.id, updateData);
    })(token, id, updates);
  });

  ipcMain.handle('category:delete', async (_event, token: unknown, id: unknown) => {
    return requireAuth((_userId) => {
      const data = validate(IdSchema, { id }, 'category:delete');
      return categoryService.delete(data.id);
    })(token, id);
  });

  // Sync (protected)
  ipcMain.handle('sync:startServer', async (_event, token: unknown) => {
    return requireAuth((_userId) => {
      const result = syncService.startServer();
      if (result.token) {
        syncService.saveSyncToken(result.token);
      }
      return result;
    })(token);
  });

  ipcMain.handle('sync:stopServer', async (_event, token: unknown) => {
    return requireAuth((_userId) => {
      syncService.stopServer();
      return { success: true, message: 'Servidor de sincronização encerrado' };
    })(token);
  });

  ipcMain.handle('sync:isHost', async (_event, token: unknown) => {
    return requireAuth((_userId) => syncService.isHost())(token);
  });

  ipcMain.handle('sync:startClient', async (_event, token: unknown, address: unknown) => {
    return requireAuth((_userId) => {
      if (typeof address !== 'string' || !address.trim()) {
        return { success: false, message: 'Endereço inválido' };
      }
      const syncToken = syncService.getSyncToken() || undefined;
      return syncService.startClient(address.trim(), syncToken);
    })(token, address);
  });

  ipcMain.handle('sync:stopClient', async (_event, token: unknown) => {
    return requireAuth((_userId) => {
      syncService.stopClient();
      return { success: true, message: 'Cliente de sincronização encerrado' };
    })(token);
  });

  ipcMain.handle('sync:pullOnce', async (_event, token: unknown, address: unknown) => {
    return requireAuth((_userId) => {
      if (typeof address !== 'string' || !address.trim()) {
        return { success: false, message: 'Endereço inválido' };
      }
      const syncToken = syncService.getSyncToken() || undefined;
      return syncService.pullOnce(address.trim(), syncToken);
    })(token, address);
  });

  ipcMain.handle('sync:getHostAddress', async (_event, token: unknown) => {
    return requireAuth((_userId) => syncService.getHostAddress())(token);
  });

  ipcMain.handle('sync:saveHostAddress', async (_event, token: unknown, address: unknown) => {
    return requireAuth((_userId) => {
      if (typeof address !== 'string' || !address.trim()) {
        return { success: false, message: 'Endereço inválido' };
      }
      syncService.saveHostState(true, address.trim());
      return { success: true };
    })(token, address);
  });

  ipcMain.handle('sync:checkHost', async (_event, token: unknown, address: unknown) => {
    return requireAuth(async (_userId) => {
      if (typeof address !== 'string' || !address.trim()) {
        return { success: false, reachable: false };
      }
      const reachable = await syncService.checkHostReachability(address.trim());
      return { success: true, reachable };
    })(token, address);
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
