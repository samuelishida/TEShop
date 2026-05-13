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
  CreateUserSchema,
  ChangePasswordSchema,
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
  log.info('Preload path: ' + preloadPath);

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

  mainWindow.webContents.on('did-finish-load', () => {
    log.info('Renderer finished loading');
  });

  mainWindow.webContents.on('console-message', (_event, level, message) => {
    const levels = ['debug', 'log', 'warn', 'error'];
    log.info(`[Renderer ${levels[level] || level}] ${message}`);
  });

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
 * Validates the token passed as the first argument before allowing the handler to execute.
 * Throws an error if token is missing/invalid so the frontend try/catch can handle it.
 */
function requireAuth<T>(handler: (userId: number) => T): (token: unknown, ...rest: unknown[]) => T {
  return (token: unknown, ..._rest: unknown[]) => {
    if (typeof token !== 'string' || !token) {
      throw new Error('Não autenticado');
    }
    const result = authService.validateToken(token);
    if (!result.valid || !result.userId) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    return safeHandler(() => handler(result.userId!));
  };
}

function requireAdmin<T>(handler: (userId: number) => T): (token: unknown, ...rest: unknown[]) => T {
  return (token: unknown, ..._rest: unknown[]) => {
    if (typeof token !== 'string' || !token) {
      throw new Error('Não autenticado');
    }
    const result = authService.validateToken(token);
    if (!result.valid || !result.userId) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const user = authService.listUsers().find((u) => u.id === result.userId);
    if (!user || user.role !== 'admin') {
      throw new Error('Permissão negada. Requer privilégios de administrador.');
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

  ipcMain.handle('auth:resetAdmin', async (_event, token: unknown) => {
    return requireAdmin((_userId) => authService.resetAdminUser())(token);
  });

  // --- Protected handlers (requireAdmin / requireAuth) ---

  ipcMain.handle('auth:createCashier', async (_event, token: unknown, username: unknown, password: unknown) => {
    return requireAdmin((_userId) => {
      const data = validate(CreateCashierSchema, { username, password }, 'auth:createCashier');
      return authService.createCashierUser(data.username, data.password);
    })(token, username, password);
  });

  ipcMain.handle('auth:createUser', async (_event, token: unknown, username: unknown, password: unknown, role: unknown) => {
    return requireAdmin((_userId) => {
      const data = validate(CreateUserSchema, { username, password, role }, 'auth:createUser');
      return authService.createUser(data.username, data.password, data.role);
    })(token, username, password, role);
  });

  ipcMain.handle('auth:changePassword', async (_event, token: unknown, oldPassword: unknown, newPassword: unknown) => {
    return requireAuth((userId) => {
      const data = validate(ChangePasswordSchema, { oldPassword, newPassword }, 'auth:changePassword');
      return authService.changePassword(userId, data.oldPassword, data.newPassword);
    })(token, oldPassword, newPassword);
  });

  ipcMain.handle('auth:listUsers', async (_event, token: unknown) => {
    return requireAdmin((_userId) => authService.listUsers())(token);
  });

  ipcMain.handle('auth:deleteUser', async (_event, token: unknown, userId: unknown) => {
    return requireAdmin((_userId) => {
      const data = validate(IdSchema, { id: userId }, 'auth:deleteUser');
      return authService.deleteUser(data.id);
    })(token, userId);
  });

  // Products — paginated (protected)
  ipcMain.handle('product:findAll', async (_event, token: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const opts = options ? validate(PaginationSchema, options, 'product:findAll') : {};
      const result = productService.findAll(opts);
      return { data: result.items, total: result.total };
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
      const result = productService.findByCategory(idData.id, opts);
      return { data: result.items, total: result.total };
    })(token, categoryId, options);
  });

  ipcMain.handle('product:search', async (_event, token: unknown, query: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      if (typeof query !== 'string') {
        return { data: [], total: 0 };
      }
      const opts = options ? validate(PaginationSchema, options, 'product:search') : {};
      const result = productService.search(query, opts);
      return { data: result.items, total: result.total };
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

  ipcMain.handle('product:bulkCreate', async (_event, token: unknown, csvData: unknown) => {
    return requireAdmin((_userId) => {
      if (typeof csvData !== 'string' || !csvData.trim()) {
        return { success: false, message: 'CSV vazio ou inválido' };
      }
      const lines = csvData.trim().split('\n');
      if (lines.length < 2) {
        return { success: false, message: 'CSV deve conter cabeçalho e pelo menos uma linha de dados' };
      }
      const header = lines[0].toLowerCase().trim();
      if (!header.includes('sku') || !header.includes('name') || !header.includes('price')) {
        return { success: false, message: 'Cabeçalho CSV inválido. Esperado: sku,name,category_id,price,stock' };
      }

      const results = { created: 0, failed: 0, errors: [] as string[] };

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 4) {
          results.failed++;
          results.errors.push(`Linha ${i + 1}: colunas insuficientes`);
          continue;
        }
        const [sku, name, categoryIdStr, priceStr, stockStr] = cols;
        if (!sku || !name || !priceStr) {
          results.failed++;
          results.errors.push(`Linha ${i + 1}: SKU, nome e preço são obrigatórios`);
          continue;
        }
        try {
          const categoryId = categoryIdStr ? parseInt(categoryIdStr) : null;
          const price = parseFloat(priceStr);
          const stock = stockStr ? parseInt(stockStr) : 0;
          if (isNaN(price) || price < 0) {
            results.failed++;
            results.errors.push(`Linha ${i + 1}: preço inválido`);
            continue;
          }
          if (isNaN(stock) || stock < 0) {
            results.failed++;
            results.errors.push(`Linha ${i + 1}: estoque inválido`);
            continue;
          }
          productService.create({ sku, name, category_id: categoryId, price, stock, data: {} });
          results.created++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(`Linha ${i + 1}: ${err.message || err}`);
        }
      }

      return {
        success: results.created > 0,
        message: `${results.created} produto(s) criado(s), ${results.failed} falha(s)`,
        created: results.created,
        failed: results.failed,
        errors: results.errors.slice(0, 10), // limit errors
      };
    })(token, csvData);
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
      const result = saleService.findRecentSales(opts);
      return { data: result.items, total: result.total };
    })(token, options);
  });

  ipcMain.handle('sale:findSalesByDate', async (_event, token: unknown, startDate: unknown, endDate: unknown, options: unknown) => {
    return requireAuth((_userId) => {
      const dateData = validate(SaleFindByDateSchema, { startDate, endDate }, 'sale:findSalesByDate');
      const opts = options ? validate(PaginationSchema, options, 'sale:findSalesByDate') : {};
      const result = saleService.findSalesByDate(dateData.startDate, dateData.endDate, opts);
      return { data: result.items, total: result.total };
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
      const result = categoryService.findAll(opts);
      return { data: result.items, total: result.total };
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

  // Sync (admin-only)
  ipcMain.handle('sync:startServer', async (_event, token: unknown) => {
    return requireAdmin((_userId) => {
      const result = syncService.startServer();
      if (result.token) {
        syncService.saveSyncToken(result.token);
      }
      return result;
    })(token);
  });

  ipcMain.handle('sync:stopServer', async (_event, token: unknown) => {
    return requireAdmin((_userId) => {
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
    return requireAdmin((_userId) => {
      if (typeof address !== 'string' || !address.trim()) {
        return { success: false, message: 'Endereço inválido' };
      }
      // isHost=false: only the admin machine is a host, cashier is saving the admin's address
      syncService.saveHostState(false, address.trim());
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
