import Database from 'better-sqlite3';
import { join } from 'path';
import { app } from 'electron';
import bcrypt from 'bcryptjs';
import { applyMigrations, getCurrentVersion } from './migrations';
import { createLogger } from '../services/logger.service';

const log = createLogger('Database');

export class DatabaseManager {
  private static instance: Database.Database | null = null;

  public static getInstance(): Database.Database {
    if (!this.instance) {
      const dbPath = join(app.getPath('userData'), 'eshop.db');
      this.instance = new Database(dbPath);

      this.instance.pragma('journal_mode = WAL');
      this.instance.pragma('foreign_keys = ON');
    }
    return this.instance;
  }

  /**
   * Set a database instance directly — used for testing.
   * Call resetInstance() to clear it after tests.
   */
  public static setInstance(db: Database.Database): void {
    this.instance = db;
  }

  public static resetInstance(): void {
    if (this.instance) {
      try {
        this.instance.close();
      } catch {
        // May already be closed in tests
      }
      this.instance = null;
    }
  }

  public static close(): void {
    if (this.instance) {
      this.instance.close();
      this.instance = null;
    }
  }
}

export async function runMigrations(): Promise<void> {
  const db = DatabaseManager.getInstance();
  const beforeVersion = getCurrentVersion(db);
  applyMigrations(db);
  const afterVersion = getCurrentVersion(db);

  if (afterVersion > beforeVersion) {
    log.info('Database migrated', { from: beforeVersion, to: afterVersion });
  }

  // Purge expired sessions on startup to keep the sessions table clean
  const deleted = db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();
  if (deleted.changes > 0) {
    log.info('Expired sessions cleaned', { count: deleted.changes });
  }

  // Seed default admin if no users exist
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number }).count;
  if (userCount === 0) {
    const salt = bcrypt.genSaltSync(12);
    const hash = bcrypt.hashSync('admin123', salt);
    db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  }

  // Seed default categories if none exist — Tana's Pet Store catalog
  const catCount = (db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number }).count;
  if (catCount === 0) {
    const categories = [
      {
        name: 'Ração para Cães a Granel',
        description: 'Ração de alta qualidade vendida por peso. Variedades de carne, frango e mix.',
        config: JSON.stringify({
          fields: [
            { id: 'flavor', label: 'Sabor', type: 'select', options: [{ value: 'carne', label: 'Carne' }, { value: 'frango', label: 'Frango' }, { value: 'peixe', label: 'Peixe' }, { value: 'mix', label: 'Mix' }] },
            { id: 'price_per_kg', label: 'Preço por Kg (R$)', type: 'number', placeholder: 'Preço por quilograma' },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Ração sabor carne para cães adultos' },
          ],
          unit: 'kg',
        }),
      },
      {
        name: 'Rações de Gato a Granel',
        description: 'Ração para gatos vendida por peso. Variedades de peixe, frango e mix.',
        config: JSON.stringify({
          fields: [
            { id: 'flavor', label: 'Sabor', type: 'select', options: [{ value: 'peixe', label: 'Peixe' }, { value: 'frango', label: 'Frango' }, { value: 'mix', label: 'Mix' }] },
            { id: 'price_per_kg', label: 'Preço por Kg (R$)', type: 'number', placeholder: 'Preço por quilograma' },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Ração sabor peixe para gatos' },
          ],
          unit: 'kg',
        }),
      },
      {
        name: 'Areia Higiênica e Granulado',
        description: 'Areia higiênica e granulado sanitário para gatos. Pacotes de 2kg.',
        config: JSON.stringify({
          fields: [
            { id: 'type', label: 'Tipo', type: 'select', options: [{ value: 'areia', label: 'Areia Higiênica Tradicional' }, { value: 'granulado-madeira', label: 'Granulado de Madeira' }] },
            { id: 'weight', label: 'Peso do Pacote', type: 'select', options: [{ value: '2kg', label: '2 kg' }, { value: '4kg', label: '4 kg' }, { value: 'outro', label: 'Outro' }] },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Areia higiênica para gatos - pacote 2kg' },
          ],
          unit: 'pacote',
        }),
      },
      {
        name: 'Produtos para Pássaros',
        description: 'Ração, bastões e acessórios para calopsitas e pássaros pequenos.',
        config: JSON.stringify({
          fields: [
            { id: 'type', label: 'Tipo de Produto', type: 'select', options: [{ value: 'racao-granel', label: 'Ração a Granel' }, { value: 'bastoes', label: 'Bastões de Semente' }, { value: 'bebedouro', label: 'Bebedouro' }] },
            { id: 'price', label: 'Preço (R$)', type: 'number', placeholder: 'Preço unitário ou por kg' },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Ração mista para calopsitas' },
          ],
          unit: 'unidade',
        }),
      },
      {
        name: 'Saúde e Medicamentos',
        description: 'Vermífugos, medicamentos e produtos de saúde para pets.',
        config: JSON.stringify({
          fields: [
            { id: 'type', label: 'Tipo', type: 'select', options: [{ value: 'vermifugo', label: 'Vermífugo' }, { value: 'antipulgas', label: 'Antipulgas' }, { value: 'vitamina', label: 'Vitamina' }, { value: 'outro', label: 'Outro' }] },
            { id: 'dose', label: 'Dose / Unidade', type: 'text', placeholder: 'Ex: 1 comprimido, 5ml' },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Vermífugo para cães e gatos' },
          ],
          unit: 'comprimido',
        }),
      },
      {
        name: 'Serviços',
        description: 'Banho, tosa e outros serviços. Agendamento por WhatsApp.',
        config: JSON.stringify({
          fields: [
            { id: 'type', label: 'Tipo de Serviço', type: 'select', options: [{ value: 'banho', label: 'Banho' }, { value: 'tosa', label: 'Tosa' }, { value: 'banho-tosa', label: 'Banho + Tosa' }, { value: 'consulta', label: 'Consulta' }] },
            { id: 'price', label: 'Preço (R$)', type: 'number', placeholder: 'Preço do serviço' },
            { id: 'description', label: 'Descrição / Observações', type: 'text', placeholder: 'Ex: Banho e tosa completa. Agendamento por WhatsApp.' },
          ],
          unit: 'servico',
        }),
      },
      {
        name: 'Acessórios para Pets',
        description: 'Coleiras, camas, brinquedos, potes e outros acessórios.',
        config: JSON.stringify({
          fields: [
            { id: 'type', label: 'Tipo de Acessório', type: 'select', options: [{ value: 'coleira', label: 'Coleira' }, { value: 'cama', label: 'Cama' }, { value: 'brinquedo', label: 'Brinquedo' }, { value: 'pote', label: 'Pote / Comedouro' }, { value: 'roupa', label: 'Roupa' }, { value: 'outro', label: 'Outro' }] },
            { id: 'price', label: 'Preço (R$)', type: 'number', placeholder: 'Preço unitário' },
            { id: 'description', label: 'Descrição', type: 'text', placeholder: 'Ex: Coleira ajustável para cães médios' },
          ],
          unit: 'unidade',
        }),
      },
    ];
    const insert = db.prepare('INSERT INTO categories (name, description, config) VALUES (?, ?, ?)');
    for (const cat of categories) {
      insert.run(cat.name, cat.description, cat.config);
    }
  }

  // Seed Tana's Pet Store catalog products if none exist
  const prodCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number }).count;
  if (prodCount === 0) {
    const products = [
      { sku: 'rc-carne', name: 'Ração Carne (granel)', category_id: 1, price: 18.90, stock: 100, data: JSON.stringify({ unit: 'kg', flavor: 'carne', description: 'Ração sabor carne para cães adultos' }) },
      { sku: 'rc-frango', name: 'Ração Frango (granel)', category_id: 1, price: 17.90, stock: 100, data: JSON.stringify({ unit: 'kg', flavor: 'frango', description: 'Ração sabor frango para cães adultos' }) },
      { sku: 'sache-caes-carne', name: 'Sachê Cães Carne', category_id: 1, price: 4.50, stock: 50, data: JSON.stringify({ unit: 'unidade', flavor: 'carne', description: 'Sachê sabor carne para cães' }) },
      { sku: 'sache-caes-frango', name: 'Sachê Cães Frango', category_id: 1, price: 4.50, stock: 50, data: JSON.stringify({ unit: 'unidade', flavor: 'frango', description: 'Sachê sabor frango para cães' }) },
      { sku: 'rg-peixe', name: 'Ração Gatos Peixe (granel)', category_id: 2, price: 22.90, stock: 80, data: JSON.stringify({ unit: 'kg', flavor: 'peixe', description: 'Ração sabor peixe para gatos' }) },
      { sku: 'rg-frango', name: 'Ração Gatos Frango (granel)', category_id: 2, price: 21.90, stock: 80, data: JSON.stringify({ unit: 'kg', flavor: 'frango', description: 'Ração sabor frango para gatos' }) },
      { sku: 'sache-gatos', name: 'Sachê de Gatos', category_id: 2, price: 3.90, stock: 60, data: JSON.stringify({ unit: 'unidade', description: 'Sachê úmido para gatos' }) },
      { sku: 'petiscos-gatos', name: 'Petiscos para Gato', category_id: 2, price: 12.90, stock: 40, data: JSON.stringify({ unit: 'pacote', description: 'Petiscos e snacks para gatos' }) },
      { sku: 'areia-tradicional', name: 'Areia Higiênica Tradicional', category_id: 3, price: 14.90, stock: 40, data: JSON.stringify({ unit: 'pacote', type: 'areia', weight: '2kg', description: 'Areia higiênica para gatos - pacote 2kg' }) },
      { sku: 'granulado-madeira', name: 'Granulado Higiênico de Madeira', category_id: 3, price: 18.90, stock: 30, data: JSON.stringify({ unit: 'pacote', type: 'granulado-madeira', weight: '2kg', description: 'Granulado higiênico de madeira biodegradável - 2kg' }) },
      { sku: 'rp-calopsita', name: 'Ração p/ Pássaro a Granel', category_id: 4, price: 15.90, stock: 50, data: JSON.stringify({ unit: 'kg', type: 'racao-granel', description: 'Ração mista para calopsitas e pássaros pequenos' }) },
      { sku: 'bastoes-calopsita', name: 'Bastões de Calopsita e Pássaro', category_id: 4, price: 8.90, stock: 20, data: JSON.stringify({ unit: 'pacote', type: 'bastoes', description: 'Bastões de semente e mel para calopsitas' }) },
      { sku: 'bebedouros', name: 'Bebedouros', category_id: 4, price: 25.00, stock: 15, data: JSON.stringify({ unit: 'unidade', type: 'bebedouro', description: 'Bebedouros para pássaros e pequenos animais' }) },
      { sku: 'vermifugo', name: 'Vermífugo', category_id: 5, price: 35.00, stock: 100, data: JSON.stringify({ unit: 'comprimido', type: 'vermifugo', dose: '1 comprimido', description: 'Vermífugo para cães e gatos' }) },
      { sku: 'banho-tosa', name: 'Banho e Tosa', category_id: 6, price: 80.00, stock: 999, data: JSON.stringify({ unit: 'servico', type: 'banho-tosa', description: 'Banho e tosa completa para cães e gatos. Agendamento por WhatsApp.' }) },
      { sku: 'acessorios', name: 'Acessórios para Pets', category_id: 7, price: 29.90, stock: 50, data: JSON.stringify({ unit: 'unidade', type: 'outro', description: 'Coleiras, camas, brinquedos, potes e outros acessórios.' }) },
    ];
    const insert = db.prepare('INSERT INTO products (sku, name, category_id, price, stock, data) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of products) {
      insert.run(p.sku, p.name, p.category_id, p.price, p.stock, p.data);
    }
  }
}