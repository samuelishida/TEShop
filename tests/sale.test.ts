// ============================================
// E-Shop PDV - Unit Tests
// Testes para transações de venda e serviços
// ============================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { join } from 'path';
import { tmpdir } from 'os';
import { ProductService } from '../src/services/product.service';
import { SaleService } from '../src/services/sale.service';
import { CategoryService } from '../src/services/category.service';
import { AuthService } from '../src/services/auth.service';
import { DatabaseManager } from '../src/database/connection';
import { Product, SaleItem } from '../src/types';

// Helper to create a test database
function createTestDatabase(): Database.Database {
  const dbPath = join(tmpdir(), `eshop-test-${Date.now()}.db`);
  const db = new Database(dbPath);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category_id INTEGER,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      parent_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  return db;
}

// Mock DatabaseManager for tests
function mockDatabaseManager(db: Database.Database) {
  const original = DatabaseManager.getInstance;
  DatabaseManager.getInstance = () => db;
  return () => {
    DatabaseManager.getInstance = original;
  };
}

describe('ProductService', () => {
  let db: Database.Database;
  let restore: () => void;
  let productService: ProductService;

  beforeEach(() => {
    db = createTestDatabase();
    restore = mockDatabaseManager(db);
    productService = new ProductService();
  });

  afterEach(() => {
    restore();
    db.close();
  });

  it('should create a product with JSONB metadata', () => {
    const product = productService.create({
      sku: 'PET-001',
      name: 'Ração Premium Cães',
      category_id: 1,
      price: 89.90,
      stock: 50,
      data: { weight: 15, flavor: 'frango', breed: 'todos' },
    });

    expect(product).toBeDefined();
    expect(product.id).toBeDefined();
    expect(product.sku).toBe('PET-001');
    expect(product.data).toEqual({ weight: 15, flavor: 'frango', breed: 'todos' });
  });

  it('should find product by SKU', () => {
    productService.create({
      sku: 'PET-002',
      name: 'Shampoo Pet',
      category_id: 1,
      price: 29.90,
      stock: 30,
      data: { volume: '500ml', brand: 'PetClean' },
    });

    const found = productService.findBySku('PET-002');
    expect(found).toBeDefined();
    expect(found?.name).toBe('Shampoo Pet');
  });

  it('should update product stock', () => {
    const product = productService.create({
      sku: 'PET-003',
      name: 'Coleira',
      category_id: 1,
      price: 45.00,
      stock: 20,
      data: { size: 'M', color: 'vermelho' },
    });

    const updated = productService.updateStock(product.id, -5);
    expect(updated).toBe(true);

    const found = productService.findById(product.id);
    expect(found?.stock).toBe(15);
  });

  it('should not allow negative stock', () => {
    const product = productService.create({
      sku: 'PET-004',
      name: 'Brinquedo',
      category_id: 1,
      price: 19.90,
      stock: 5,
      data: { material: 'borracha' },
    });

    const updated = productService.updateStock(product.id, -10);
    expect(updated).toBe(false);

    const found = productService.findById(product.id);
    expect(found?.stock).toBe(5);
  });

  it('should search products by name', () => {
    productService.create({
      sku: 'PET-005',
      name: 'Ração Premium Gatos',
      category_id: 1,
      price: 79.90,
      stock: 40,
      data: { weight: 10, flavor: 'peixe' },
    });

    const results = productService.search('gatos');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('Gatos');
  });

  it('should get low stock products', () => {
    productService.create({
      sku: 'PET-006',
      name: 'Produto Estoque Baixo',
      category_id: 1,
      price: 10.00,
      stock: 5,
      data: {},
    });

    productService.create({
      sku: 'PET-007',
      name: 'Produto Estoque OK',
      category_id: 1,
      price: 10.00,
      stock: 50,
      data: {},
    });

    const lowStock = productService.getLowStock(10);
    expect(lowStock.length).toBe(1);
    expect(lowStock[0].sku).toBe('PET-006');
  });
});

describe('SaleService', () => {
  let db: Database.Database;
  let restore: () => void;
  let productService: ProductService;
  let saleService: SaleService;

  beforeEach(() => {
    db = createTestDatabase();
    restore = mockDatabaseManager(db);
    productService = new ProductService();
    saleService = new SaleService();
  });

  afterEach(() => {
    restore();
    db.close();
  });

  it('should create a sale and deduct stock (ACID transaction)', () => {
    // Create test products
    const product1 = productService.create({
      sku: 'PET-100',
      name: 'Ração Cães 15kg',
      category_id: 1,
      price: 89.90,
      stock: 50,
      data: { weight: 15, flavor: 'frango' },
    });

    const product2 = productService.create({
      sku: 'PET-101',
      name: 'Shampoo Pet 500ml',
      category_id: 1,
      price: 29.90,
      stock: 30,
      data: { volume: '500ml', brand: 'PetClean' },
    });

    // Create sale items
    const items: Omit<SaleItem, 'total'>[] = [
      { product_id: product1.id, quantity: 2, unit_price: 89.90 },
      { product_id: product2.id, quantity: 1, unit_price: 29.90 },
    ];

    // Execute sale
    const sale = saleService.createSale(items, 'cash');

    // Assertions
    expect(sale).toBeDefined();
    expect(sale).not.toBeNull();
    expect(sale?.id).toBeDefined();
    expect(sale?.total).toBeCloseTo(209.70, 2); // 2 * 89.90 + 1 * 29.90
    expect(sale?.payment_method).toBe('cash');
    expect(sale?.items.length).toBe(2);

    // Verify stock was deducted
    const updatedProduct1 = productService.findById(product1.id);
    const updatedProduct2 = productService.findById(product2.id);

    expect(updatedProduct1?.stock).toBe(48); // 50 - 2
    expect(updatedProduct2?.stock).toBe(29); // 30 - 1
  });

  it('should fail sale when stock is insufficient (ACID rollback)', () => {
    const product = productService.create({
      sku: 'PET-102',
      name: 'Produto Estoque Limitado',
      category_id: 1,
      price: 50.00,
      stock: 3,
      data: {},
    });

    const items: Omit<SaleItem, 'total'>[] = [
      { product_id: product.id, quantity: 5, unit_price: 50.00 },
    ];

    // This should fail and rollback
    const sale = saleService.createSale(items, 'credit');

    expect(sale).toBeNull();

    // Verify stock was NOT deducted (rollback worked)
    const unchangedProduct = productService.findById(product.id);
    expect(unchangedProduct?.stock).toBe(3);
  });

  it('should fail sale when product does not exist', () => {
    const items: Omit<SaleItem, 'total'>[] = [
      { product_id: 99999, quantity: 1, unit_price: 50.00 },
    ];

    const sale = saleService.createSale(items, 'cash');
    expect(sale).toBeNull();
  });

  it('should calculate sale total correctly with multiple items', () => {
    const product1 = productService.create({
      sku: 'PET-103',
      name: 'Item A',
      category_id: 1,
      price: 10.00,
      stock: 100,
      data: {},
    });

    const product2 = productService.create({
      sku: 'PET-104',
      name: 'Item B',
      category_id: 1,
      price: 25.50,
      stock: 100,
      data: {},
    });

    const product3 = productService.create({
      sku: 'PET-105',
      name: 'Item C',
      category_id: 1,
      price: 7.30,
      stock: 100,
      data: {},
    });

    const items: Omit<SaleItem, 'total'>[] = [
      { product_id: product1.id, quantity: 3, unit_price: 10.00 },
      { product_id: product2.id, quantity: 2, unit_price: 25.50 },
      { product_id: product3.id, quantity: 5, unit_price: 7.30 },
    ];

    const sale = saleService.createSale(items, 'pix');

    expect(sale).toBeDefined();
    expect(sale).not.toBeNull();
    // 3 * 10.00 + 2 * 25.50 + 5 * 7.30 = 30.00 + 51.00 + 36.50 = 117.50
    expect(sale?.total).toBeCloseTo(117.50, 2);
  });

  it('should find recent sales', () => {
    const product = productService.create({
      sku: 'PET-106',
      name: 'Item Teste',
      category_id: 1,
      price: 20.00,
      stock: 100,
      data: {},
    });

    // Create 3 sales
    for (let i = 0; i < 3; i++) {
      saleService.createSale(
        [{ product_id: product.id, quantity: 1, unit_price: 20.00 }],
        'cash'
      );
    }

    const recentSales = saleService.findRecentSales(10);
    expect(recentSales.length).toBe(3);
  });

  it('should generate sales report', () => {
    const product = productService.create({
      sku: 'PET-107',
      name: 'Item Report',
      category_id: 1,
      price: 100.00,
      stock: 100,
      data: {},
    });

    // Create multiple sales
    saleService.createSale(
      [{ product_id: product.id, quantity: 2, unit_price: 100.00 }],
      'cash'
    );

    saleService.createSale(
      [{ product_id: product.id, quantity: 3, unit_price: 100.00 }],
      'credit'
    );

    const report = saleService.getReport();

    expect(report.total_sales).toBe(2);
    expect(report.total_revenue).toBe(500.00); // 2*100 + 3*100
    expect(report.top_products.length).toBeGreaterThan(0);
    expect(report.top_products[0].quantity).toBe(5);
  });

  it('should handle concurrent stock deductions correctly', () => {
    const product = productService.create({
      sku: 'PET-108',
      name: 'Item Concorrência',
      category_id: 1,
      price: 50.00,
      stock: 10,
      data: {},
    });

    // Simulate two sales trying to buy 6 and 5 units (total 11 > 10)
    const items1: Omit<SaleItem, 'total'>[] = [
      { product_id: product.id, quantity: 6, unit_price: 50.00 },
    ];

    const items2: Omit<SaleItem, 'total'>[] = [
      { product_id: product.id, quantity: 5, unit_price: 50.00 },
    ];

    // First sale should succeed
    const sale1 = saleService.createSale(items1, 'cash');
    expect(sale1).not.toBeNull();

    // Second sale should fail (only 4 left)
    const sale2 = saleService.createSale(items2, 'cash');
    expect(sale2).toBeNull();

    // Verify final stock
    const finalProduct = productService.findById(product.id);
    expect(finalProduct?.stock).toBe(4); // 10 - 6
  });
});

describe('CategoryService', () => {
  let db: Database.Database;
  let restore: () => void;
  let categoryService: CategoryService;

  beforeEach(() => {
    db = createTestDatabase();
    restore = mockDatabaseManager(db);
    categoryService = new CategoryService();
  });

  afterEach(() => {
    restore();
    db.close();
  });

  it('should create a category', () => {
    const category = categoryService.create({
      name: 'Alimentos',
      description: 'Rações e petiscos',
    });

    expect(category).toBeDefined();
    expect(category.id).toBeDefined();
    expect(category.name).toBe('Alimentos');
  });

  it('should find all categories', () => {
    categoryService.create({ name: 'Alimentos', description: '' });
    categoryService.create({ name: 'Higiene', description: '' });
    categoryService.create({ name: 'Brinquedos', description: '' });

    const categories = categoryService.findAll();
    expect(categories.length).toBe(3);
  });

  it('should update a category', () => {
    const category = categoryService.create({
      name: 'Old Name',
      description: 'Old Desc',
    });

    const updated = categoryService.update(category.id, {
      name: 'New Name',
      description: 'New Desc',
    });

    expect(updated?.name).toBe('New Name');
    expect(updated?.description).toBe('New Desc');
  });

  it('should delete a category', () => {
    const category = categoryService.create({
      name: 'To Delete',
      description: '',
    });

    const deleted = categoryService.delete(category.id);
    expect(deleted).toBe(true);

    const found = categoryService.findById(category.id);
    expect(found).toBeUndefined();
  });
});

describe('AuthService', () => {
  let db: Database.Database;
  let restore: () => void;
  let authService: AuthService;

  beforeEach(() => {
    db = createTestDatabase();
    restore = mockDatabaseManager(db);
    authService = new AuthService();

    // Create a test user
    const bcrypt = require('bcryptjs');
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin123', salt);

    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)')
      .run('admin', hash);
  });

  afterEach(() => {
    restore();
    db.close();
  });

  it('should login with correct credentials', () => {
    const result = authService.login({
      username: 'admin',
      password: 'admin123',
    });

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.username).toBe('admin');
    expect(result.user?.password_hash).toBeUndefined();
  });

  it('should reject invalid password', () => {
    const result = authService.login({
      username: 'admin',
      password: 'wrongpassword',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('should reject non-existent user', () => {
    const result = authService.login({
      username: 'nonexistent',
      password: 'anypassword',
    });

    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('should change password with correct old password', () => {
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin') as any;

    const result = authService.changePassword(user.id, 'admin123', 'newpassword');
    expect(result.success).toBe(true);

    // Verify new password works
    const loginResult = authService.login({
      username: 'admin',
      password: 'newpassword',
    });
    expect(loginResult.success).toBe(true);
  });

  it('should reject password change with wrong old password', () => {
    const user = db.prepare('SELECT * FROM admin_users WHERE username = ?').get('admin') as any;

    const result = authService.changePassword(user.id, 'wrongpassword', 'newpassword');
    expect(result.success).toBe(false);
  });
});

describe('JSONB Metadata Strategy', () => {
  let db: Database.Database;
  let restore: () => void;
  let productService: ProductService;

  beforeEach(() => {
    db = createTestDatabase();
    restore = mockDatabaseManager(db);
    productService = new ProductService();
  });

  afterEach(() => {
    restore();
    db.close();
  });

  it('should store pet shop metadata (weight, flavor, breed)', () => {
    const product = productService.create({
      sku: 'PET-200',
      name: 'Ração Premium',
      category_id: 1,
      price: 120.00,
      stock: 30,
      data: {
        weight: 15,
        flavor: 'frango',
        breed: 'todos',
        life_stage: 'adulto',
      },
    });

    const found = productService.findById(product.id);
    expect(found?.data.weight).toBe(15);
    expect(found?.data.flavor).toBe('frango');
    expect(found?.data.breed).toBe('todos');
    expect(found?.data.life_stage).toBe('adulto');
  });

  it('should store clothing metadata (size, color, material)', () => {
    const product = productService.create({
      sku: 'CLO-001',
      name: 'Camiseta Básica',
      category_id: 2,
      price: 49.90,
      stock: 100,
      data: {
        size: 'M',
        color: 'azul',
        material: 'algodão',
        sleeve_length: 'curta',
      },
    });

    const found = productService.findById(product.id);
    expect(found?.data.size).toBe('M');
    expect(found?.data.color).toBe('azul');
    expect(found?.data.material).toBe('algodão');
  });

  it('should store electronics metadata (brand, warranty, voltage)', () => {
    const product = productService.create({
      sku: 'ELEC-001',
      name: 'Ferro de Passar',
      category_id: 3,
      price: 159.90,
      stock: 25,
      data: {
        brand: 'Philips',
        warranty_months: 12,
        voltage: '110V',
        power: '1200W',
      },
    });

    const found = productService.findById(product.id);
    expect(found?.data.brand).toBe('Philips');
    expect(found?.data.warranty_months).toBe(12);
    expect(found?.data.voltage).toBe('110V');
  });

  it('should update metadata without affecting other fields', () => {
    const product = productService.create({
      sku: 'PET-201',
      name: 'Produto Teste',
      category_id: 1,
      price: 50.00,
      stock: 20,
      data: { flavor: 'frango' },
    });

    const updated = productService.update(product.id, {
      data: { flavor: 'carne', weight: 10 },
    });

    expect(updated?.data.flavor).toBe('carne');
    expect(updated?.data.weight).toBe(10);
    expect(updated?.price).toBe(50.00); // Unchanged
    expect(updated?.stock).toBe(20); // Unchanged
  });
});
