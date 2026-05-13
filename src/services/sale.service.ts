import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { Sale, SaleItem, SaleReport } from '../types';
import { createLogger } from './logger.service';

const log = createLogger('SaleService');

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class SaleService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public createSale(items: Omit<SaleItem, 'total'>[], paymentMethod: string): Sale | null {
    const transaction = this.db.transaction((items: Omit<SaleItem, 'total'>[]) => {
      // Aggregate quantities per product for validation
      const productQuantities = new Map<number, number>();
      for (const item of items) {
        productQuantities.set(item.product_id, (productQuantities.get(item.product_id) || 0) + item.quantity);
      }

      // Validate products and aggregated stock
      const productMap = new Map<number, any>();
      for (const [productId, totalQuantity] of productQuantities) {
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as any;
        if (!product) {
          throw new Error(`Produto ${productId} não encontrado`);
        }
        productMap.set(productId, product);

        const productData = typeof product.data === 'string' ? JSON.parse(product.data) : product.data;
        const isService = productData?.unit === 'servico' || productData?.type === 'banho-tosa';
        if (!isService && product.stock < totalQuantity) {
          throw new Error(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock}, necessário: ${totalQuantity}`);
        }
      }

      const saleItems: SaleItem[] = [];
      let total = 0;
      for (const item of items) {
        const itemTotal = item.unit_price * item.quantity;
        saleItems.push({ ...item, total: itemTotal });
        total += itemTotal;
      }

      const saleResult = this.db.prepare(`
        INSERT INTO sales (total, payment_method, status)
        VALUES (?, ?, 'completed')
      `).run(total, paymentMethod);

      const saleId = saleResult.lastInsertRowid as number;

      for (const item of saleItems) {
        this.db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
          VALUES (?, ?, ?, ?, ?)
        `).run(saleId, item.product_id, item.quantity, item.unit_price, item.total);
      }

      // Update stock once per product using aggregated quantity
      for (const [productId, totalQuantity] of productQuantities) {
        const product = productMap.get(productId);
        const productData = typeof product.data === 'string' ? JSON.parse(product.data) : product.data;
        const isService = productData?.unit === 'servico' || productData?.type === 'banho-tosa';
        if (!isService) {
          const result = this.db.prepare(`
            UPDATE products
            SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND stock >= ?
          `).run(totalQuantity, productId, totalQuantity);
          if (result.changes === 0) {
            throw new Error(`Estoque insuficiente para ${product.name} (concorrência detectada)`);
          }
        }
      }

      return {
        id: saleId,
        items: saleItems,
        total,
        payment_method: paymentMethod,
        status: 'completed' as const,
        created_at: new Date().toISOString(),
      };
    });

    try {
      return transaction(items);
    } catch (error) {
      log.error('Erro ao processar venda', { error: String(error) });
      return null;
    }
  }

  /**
   * Cancel a sale — restores stock and marks sale as cancelled.
   */
  public cancelSale(saleId: number): { success: boolean; message: string } {
    const sale = this.db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId) as any;
    if (!sale) {
      return { success: false, message: 'Venda não encontrada' };
    }
    if (sale.status === 'cancelled') {
      return { success: false, message: 'Venda já está cancelada' };
    }

    const transaction = this.db.transaction(() => {
      // Restore stock for each item (skip services)
      const items = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[];
      for (const item of items) {
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id) as any;
        if (!product) {
          continue;
        }
        const productData = typeof product.data === 'string' ? JSON.parse(product.data) : product.data;
        const isService = productData?.unit === 'servico' || productData?.type === 'banho-tosa';
        if (!isService) {
          this.db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(item.quantity, item.product_id);
        }
      }

      // Mark sale as cancelled
      this.db.prepare("UPDATE sales SET status = 'cancelled' WHERE id = ?").run(saleId);
    });

    try {
      transaction();
      return { success: true, message: 'Venda cancelada com sucesso' };
    } catch (error) {
      log.error('Erro ao cancelar venda', { error: String(error) });
      return { success: false, message: 'Erro ao cancelar venda' };
    }
  }

  private hydrateSale(row: any): Sale {
    const items = this.db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(row.id) as SaleItem[];
    return {
      id: row.id,
      items,
      total: row.total,
      payment_method: row.payment_method,
      status: row.status || 'completed',
      created_at: row.created_at,
    };
  }

  public findRecentSales(options: PaginationOptions = {}): PaginatedResult<Sale> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    const total = (this.db.prepare('SELECT COUNT(*) as total FROM sales').get() as { total: number }).total;

    const rows = this.db.prepare(`
      SELECT * FROM sales
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as any[];

    const items = rows.map(row => this.hydrateSale(row));

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public findSalesByDate(startDate: string, endDate: string, options: PaginationOptions = {}): PaginatedResult<Sale> {
    const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
    const offset = Math.max(options.offset ?? 0, 0);

    // Normalize plain YYYY-MM-DD dates to include full day range
    const start = startDate.length === 10 ? startDate + ' 00:00:00' : startDate;
    const end = endDate.length === 10 ? endDate + ' 23:59:59' : endDate;

    const total = (this.db.prepare(`
      SELECT COUNT(*) as total FROM sales WHERE created_at BETWEEN ? AND ?
    `).get(start, end) as { total: number }).total;

    const rows = this.db.prepare(`
      SELECT * FROM sales
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(start, end, limit, offset) as any[];

    const items = rows.map(row => this.hydrateSale(row));

    return { items, total, limit, offset, hasMore: offset + items.length < total };
  }

  public getReport(startDate?: string, endDate?: string): SaleReport {
    const whereClauses = ["s.status = 'completed'"];
    const params: any[] = [];

    if (startDate && endDate) {
      // Normalize plain YYYY-MM-DD dates to full datetime so BETWEEN includes all records on the end day
      const start = startDate.length === 10 ? startDate + ' 00:00:00' : startDate;
      const end = endDate.length === 10 ? endDate + ' 23:59:59' : endDate;
      whereClauses.push('s.created_at BETWEEN ? AND ?');
      params.push(start, end);
    }

    const whereClause = 'WHERE ' + whereClauses.join(' AND ');

    const salesData = this.db.prepare(`
      SELECT COUNT(*) as total_sales, COALESCE(SUM(s.total), 0) as total_revenue
      FROM sales s
      ${whereClause}
    `).all(...params) as Array<{ total_sales: number; total_revenue: number }>;

    const { total_sales, total_revenue } = salesData[0];

    const topProducts = this.db.prepare(`
      SELECT p.name, SUM(si.quantity) as quantity, SUM(si.total) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      ${whereClause}
      GROUP BY si.product_id
      ORDER BY quantity DESC
      LIMIT 10
    `).all(...params) as Array<{ name: string; quantity: number; revenue: number }>;

    const days = startDate && endDate
      ? Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24)))
      : 1;

    const daily_average = total_revenue / days;

    return {
      total_sales,
      total_revenue,
      top_products: topProducts,
      daily_average,
    };
  }

  private toSQLiteDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  public getTodaySales(): Sale[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return (this.findSalesByDate(this.toSQLiteDate(today), this.toSQLiteDate(tomorrow)) as any).items;
  }

  public getTodayRevenue(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue
      FROM sales
      WHERE created_at BETWEEN ? AND ? AND status = 'completed'
    `).get(this.toSQLiteDate(today), this.toSQLiteDate(tomorrow)) as { revenue: number };

    return result.revenue;
  }
}
