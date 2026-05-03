import Database from 'better-sqlite3';
import { DatabaseManager } from '../database/connection';
import { Sale, SaleItem, SaleReport, Product } from '../types';

export class SaleService {
  private db: Database.Database;

  constructor() {
    this.db = DatabaseManager.getInstance();
  }

  public createSale(items: Omit<SaleItem, 'total'>[], paymentMethod: string): Sale | null {
    const transaction = this.db.transaction((items: Omit<SaleItem, 'total'>[]) => {
      const saleItems: SaleItem[] = [];
      let total = 0;

      // Validate stock availability
      for (const item of items) {
        const product = this.db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
        
        if (!product) {
          throw new Error(`Produto ${item.product_id} não encontrado`);
        }

        const prod = product as Product;
        if (prod.stock < item.quantity) {
          throw new Error(`Estoque insuficiente para ${prod.name}. Disponível: ${prod.stock}`);
        }

        const itemTotal = item.unit_price * item.quantity;
        saleItems.push({ ...item, total: itemTotal });
        total += itemTotal;
      }

      // Insert sale
      const saleResult = this.db.prepare(`
        INSERT INTO sales (items, total, payment_method)
        VALUES (?, ?, ?)
      `).run(JSON.stringify(saleItems), total, paymentMethod);

      const saleId = saleResult.lastInsertRowid as number;

      // Insert sale items and update stock
      for (const item of saleItems) {
        // Insert sale item record
        this.db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total)
          VALUES (?, ?, ?, ?, ?)
        `).run(saleId, item.product_id, item.quantity, item.unit_price, item.total);

        // Deduct stock
        this.db.prepare(`
          UPDATE products 
          SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `).run(item.quantity, item.product_id);
      }

      return {
        id: saleId,
        items: saleItems,
        total,
        payment_method: paymentMethod,
        created_at: new Date().toISOString(),
      };
    });

    try {
      return transaction(items);
    } catch (error) {
      console.error('Erro ao processar venda:', error);
      return null;
    }
  }

  public findRecentSales(limit: number = 50): Sale[] {
    const stmt = this.db.prepare(`
      SELECT *, json(items) as items 
      FROM sales 
      ORDER BY created_at DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as unknown as Sale[];
  }

  public findSalesByDate(startDate: string, endDate: string): Sale[] {
    const stmt = this.db.prepare(`
      SELECT *, json(items) as items 
      FROM sales 
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `);
    return stmt.all(startDate, endDate) as unknown as Sale[];
  }

  public getReport(startDate?: string, endDate?: string): SaleReport {
    let whereClause = '';
    const params: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE created_at BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    // Total sales count and revenue
    const salesData = this.db.prepare(`
      SELECT COUNT(*) as total_sales, COALESCE(SUM(total), 0) as total_revenue
      FROM sales ${whereClause}
    `).all(...params) as Array<{ total_sales: number; total_revenue: number }>;

    const { total_sales, total_revenue } = salesData[0];

    // Top products
    const topProducts = this.db.prepare(`
      SELECT p.name, SUM(si.quantity) as quantity, SUM(si.total) as revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      ${whereClause}
      GROUP BY si.product_id
      ORDER BY quantity DESC
      LIMIT 10
    `).all(...params) as Array<{ name: string; quantity: number; revenue: number }>;

    // Daily average
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

  public getTodaySales(): Sale[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.findSalesByDate(
      today.toISOString(),
      tomorrow.toISOString()
    );
  }

  public getTodayRevenue(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const result = this.db.prepare(`
      SELECT COALESCE(SUM(total), 0) as revenue
      FROM sales 
      WHERE created_at BETWEEN ? AND ?
    `).get(today.toISOString(), tomorrow.toISOString()) as { revenue: number };
    
    return result.revenue;
  }
}
