import http from 'http';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { createLogger } from './logger.service';

const log = createLogger('Sync');

const SYNC_PORT = 38475;
const SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes
const SYNC_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for sync tokens

let server: http.Server | null = null;
let syncInterval: NodeJS.Timeout | null = null;

/** Shared secret for sync authentication — regenerated on each server start */
let syncSecret: string = '';

interface SyncPayload {
  timestamp: number;
  products: any[];
  categories: any[];
  sales: any[];
  saleItems: any[];
  users: any[];
}

/** Generate an HMAC-SHA256 token for sync authentication */
function generateSyncToken(payload: string): string {
  return crypto.createHmac('sha256', syncSecret).update(payload).digest('hex');
}

/** Verify a sync token */
function verifySyncToken(token: string, payload: string): boolean {
  const expected = generateSyncToken(payload);
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export class SyncService {
  /**
   * Start sync server (admin only).
   * Only starts if not already running.
   */
  public startServer(): { success: boolean; isHost: boolean; message: string; token?: string } {
    if (server) {
      return { success: true, isHost: true, message: 'Servidor de sincronização já está rodando' };
    }

    try {
      // Generate a new sync secret on each server start
      syncSecret = crypto.randomBytes(32).toString('hex');

      server = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        if (req.url === '/sync' && req.method === 'GET') {
          // Require Authorization: Bearer <token>
          const authHeader = req.headers['authorization'];
          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Não autenticado' }));
            return;
          }
          const token = authHeader.slice(7);
          // Token payload is the sync secret itself — verifies this client connected to this server instance
          if (!verifySyncToken(token, syncSecret)) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Token inválido' }));
            return;
          }

          const payload = this.getSyncPayload();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(payload));
        } else if (req.url === '/ping' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', role: 'admin' }));
        } else {
          res.writeHead(404);
          res.end();
        }
      });

      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          log.warn('Port already in use, another host may exist');
        }
        server = null;
      });

      server.listen(SYNC_PORT, '0.0.0.0', () => {
        log.info('Server started', { port: SYNC_PORT });
        this.saveHostState(true);
      });

      // Generate the sync token for clients to use
      const syncToken = generateSyncToken(syncSecret);
      return { success: true, isHost: true, message: `Servidor de sincronização iniciado na porta ${SYNC_PORT}`, token: syncToken };
    } catch (error) {
      log.error('Failed to start server', { error: String(error) });
      return { success: false, isHost: true, message: 'Erro ao iniciar servidor de sincronização' };
    }
  }

  /**
   * Stop sync server.
   */
  public stopServer(): void {
    if (server) {
      server.close();
      server = null;
      this.saveHostState(false);
      log.info('Server stopped');
    }
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  /**
   * Check if we are the host.
   */
  public isHost(): boolean {
    return server !== null;
  }

  /**
   * Get the saved host address from database.
   */
  public getHostAddress(): string | null {
    const db = DatabaseManager.getInstance();
    const state = db.prepare('SELECT value FROM app_state WHERE key = ?').get('host_address') as { value: string } | undefined;
    return state ? state.value : null;
  }

  /**
   * Save host address to database.
   */
  public saveHostState(isHost: boolean, address?: string): void {
    const db = DatabaseManager.getInstance();
    const upsert = db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)');
    upsert.run('is_host', isHost ? '1' : '0');
    if (address) {
      upsert.run('host_address', address);
    }
  }

  /**
   * Start sync client (cashier only) - polls admin server every 10 minutes.
   */
  public startClient(adminAddress: string, syncToken?: string): { success: boolean; message: string } {
    this.stopClient();

    const doSync = async () => {
      try {
        log.info('Syncing with admin', { address: adminAddress });
        const result = await this.pullFromHost(adminAddress, syncToken);
        if (result.success) {
          log.info('Sync completed successfully');
        } else {
          log.warn('Sync failed', { message: result.message });
        }
      } catch (error) {
        log.error('Sync error', { error: String(error) });
      }
    };

    doSync();
    syncInterval = setInterval(doSync, SYNC_INTERVAL);

    return { success: true, message: `Sincronização iniciada com ${adminAddress}` };
  }

  /**
   * Stop sync client.
   */
  public stopClient(): void {
    if (syncInterval) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  /**
   * Pull data from admin server.
   */
  public async pullFromHost(address: string, syncToken?: string): Promise<{ success: boolean; message: string; data?: SyncPayload }> {
    try {
      const headers: Record<string, string> = {};
      if (syncToken) {
        headers['Authorization'] = `Bearer ${syncToken}`;
      }

      const url = `http://${address}:${SYNC_PORT}/sync`;
      const response = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(10000) });

      if (!response.ok) {
        return { success: false, message: `Servidor retornou erro: ${response.status}` };
      }

      const data = await response.json() as SyncPayload;
      this.applySyncData(data);

      return { success: true, message: 'Dados sincronizados com sucesso', data };
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error?.cause?.message?.includes('fetch')) {
        return { success: false, message: 'Servidor não encontrado. Verifique se o admin está online.' };
      }
      return { success: false, message: `Erro na sincronização: ${error.message}` };
    }
  }

  /**
   * Pull once from host (used on login for cashiers).
   */
  public async pullOnce(address: string, syncToken?: string): Promise<{ success: boolean; message: string }> {
    const result = await this.pullFromHost(address, syncToken);
    if (result.success) {
      this.startClient(address, syncToken);
    }
    return { success: result.success, message: result.message };
  }

  /**
   * Save sync token to database for cashiers to retrieve.
   */
  public saveSyncToken(token: string): void {
    const db = DatabaseManager.getInstance();
    db.prepare('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)').run('sync_token', token);
  }

  /**
   * Get the saved sync token (used by cashiers to authenticate with admin).
   */
  public getSyncToken(): string | null {
    const db = DatabaseManager.getInstance();
    const state = db.prepare('SELECT value FROM app_state WHERE key = ?').get('sync_token') as { value: string } | undefined;
    return state ? state.value : null;
  }

  /**
   * Get all data for syncing (password hashes excluded).
   */
  private getSyncPayload(): SyncPayload {
    const db = DatabaseManager.getInstance();

    const products = db.prepare('SELECT * FROM products').all();
    const categories = db.prepare('SELECT * FROM categories').all();
    const sales = db.prepare('SELECT * FROM sales').all();
    const saleItems = db.prepare('SELECT * FROM sale_items').all();
    const users = db.prepare('SELECT id, username, role, created_at FROM admin_users').all();

    return {
      timestamp: Date.now(),
      products,
      categories,
      sales,
      saleItems,
      users,
    };
  }

  /**
   * Apply synced data using non-destructive upsert/merge strategy.
   * - Categories, products, sale_items: INSERT OR REPLACE by primary key (preserves local-only records with higher IDs)
   * - Sales: INSERT OR REPLACE by primary key (newer local sales are kept, incoming ones added)
   * - admin_users: INSERT OR REPLACE by id (only syncs roles/usernames, never overwrites local password_hash)
   */
  private applySyncData(data: SyncPayload): void {
    const db = DatabaseManager.getInstance();

    const applyAll = db.transaction(() => {
      // Categories — upsert by id, preserve local children
      {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO categories (id, name, description, parent_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const c of data.categories) {
          upsert.run(c.id, c.name, c.description, c.parent_id, c.created_at);
        }
      }

      // Products — upsert by id, preserve local stock and data
      {
        const existingIds = new Set(
          (db.prepare('SELECT id FROM products').all() as { id: number }[]).map(r => r.id)
        );

        const upsert = db.prepare(`
          INSERT OR REPLACE INTO products (id, sku, name, category_id, price, stock, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertNew = db.prepare(`
          INSERT INTO products (id, sku, name, category_id, price, stock, data, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of data.products) {
          if (existingIds.has(p.id)) {
            // Merge strategy: keep local stock and data, update metadata from host
            const local = db.prepare('SELECT stock, data FROM products WHERE id = ?').get(p.id) as { stock: number; data: string } | undefined;
            const localStock = local?.stock ?? p.stock;
            const localData = local?.data ?? p.data;
            upsert.run(p.id, p.sku, p.name, p.category_id, p.price, localStock, localData, p.created_at, p.updated_at);
          } else {
            insertNew.run(p.id, p.sku, p.name, p.category_id, p.price, p.stock, p.data, p.created_at, p.updated_at);
          }
        }
      }

      // Sales — upsert by id, preserve local-only sales
      {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO sales (id, total, payment_method, status, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        for (const s of data.sales) {
          upsert.run(s.id, s.total, s.payment_method, s.status || 'completed', s.created_at);
        }
      }

      // Sale items — upsert by id
      {
        const upsert = db.prepare(`
          INSERT OR REPLACE INTO sale_items (id, sale_id, product_id, quantity, unit_price, total)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const i of data.saleItems) {
          upsert.run(i.id, i.sale_id, i.product_id, i.quantity, i.unit_price, i.total);
        }
      }

      // Users — upsert by id, NEVER overwrite password_hash
      {
        for (const u of data.users) {
          const local = db.prepare('SELECT id, password_hash FROM admin_users WHERE id = ?').get(u.id) as { id: number; password_hash: string } | undefined;
          if (local) {
            // Local password hash is protected — only update role/username if needed
            db.prepare('UPDATE admin_users SET username = ?, role = ? WHERE id = ?')
              .run(u.username, u.role, u.id);
          } else {
            // New user from host (should not have password_hash, but leave it null)
            db.prepare('INSERT OR IGNORE INTO admin_users (id, username, role, created_at) VALUES (?, ?, ?, ?)')
              .run(u.id, u.username, u.role, u.created_at);
          }
        }
      }
    });

    try {
      applyAll();
      log.info('Data applied successfully', { strategy: 'upsert' });
    } catch (error) {
      log.error('Failed to apply sync data', { error: String(error) });
    }
  }

  /**
   * Check if admin server is reachable.
   */
  public async checkHostReachability(address: string): Promise<boolean> {
    try {
      const response = await fetch(`http://${address}:${SYNC_PORT}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const syncService = new SyncService();
