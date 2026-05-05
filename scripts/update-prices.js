const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');

// Get the same db path the app uses
const dbPath = path.join(os.homedir(), '.config', 'eshop-pdv', 'eshop.db');
console.log('Updating prices in:', dbPath);

const db = new Database(dbPath);

const priceUpdates = [
  { sku: 'rc-carne', price: 18.90 },
  { sku: 'rc-frango', price: 17.90 },
  { sku: 'sache-caes-carne', price: 4.50 },
  { sku: 'sache-caes-frango', price: 4.50 },
  { sku: 'rg-peixe', price: 22.90 },
  { sku: 'rg-frango', price: 21.90 },
  { sku: 'sache-gatos', price: 3.90 },
  { sku: 'petiscos-gatos', price: 12.90 },
  { sku: 'areia-tradicional', price: 14.90 },
  { sku: 'granulado-madeira', price: 18.90 },
  { sku: 'rp-calopsita', price: 15.90 },
  { sku: 'bastoes-calopsita', price: 8.90 },
  { sku: 'bebedouros', price: 25.00 },
  { sku: 'vermifugo', price: 35.00 },
  { sku: 'banho-tosa', price: 80.00 },
  { sku: 'acessorios', price: 29.90 },
];

const updateStmt = db.prepare('UPDATE products SET price = ? WHERE sku = ?');

let updated = 0;
for (const { sku, price } of priceUpdates) {
  const result = updateStmt.run(price, sku);
  if (result.changes > 0) {
    console.log(`✅ ${sku}: R$ ${price.toFixed(2)}`);
    updated++;
  } else {
    console.log(`⚠️ ${sku}: not found`);
  }
}

console.log(`\n${updated} product(s) updated.`);
db.close();
