#!/usr/bin/env node
/**
 * Reset Admin User Script
 * Usage: npm run reset-admin
 * 
 * Resets the admin user password to 'admin123'.
 * If the admin user doesn't exist, creates it.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Determine the database path (same as Electron's userData)
const appName = 'E-Shop PDV';
let dbDir;

switch (process.platform) {
  case 'linux':
    dbDir = path.join(os.homedir(), '.config', appName);
    break;
  case 'darwin':
    dbDir = path.join(os.homedir(), 'Library', 'Application Support', appName);
    break;
  case 'win32':
    dbDir = path.join(os.homedir(), 'AppData', 'Roaming', appName);
    break;
  default:
    dbDir = path.join(os.homedir(), '.config', appName);
}

const dbPath = path.join(dbDir, 'eshop.db');

console.log('🐾 E-Shop PDV - Admin User Reset');
console.log('================================');
console.log(`Database path: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ Database not found. Run the app at least once first.');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

const salt = bcrypt.genSaltSync(10);
const hash = bcrypt.hashSync('admin123', salt);

const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');

if (existing) {
  db.prepare('UPDATE admin_users SET password_hash = ?, role = ? WHERE username = ?').run(hash, 'admin', 'admin');
  console.log('✅ Admin password reset to: admin123 (role: admin)');
} else {
  db.prepare('INSERT INTO admin_users (username, password_hash, role) VALUES (?, ?, ?)').run('admin', hash, 'admin');
  console.log('✅ Admin user created with password: admin123 (role: admin)');
}

// Fix any other users with wrong roles
db.prepare(`UPDATE admin_users SET role = 'caixa' WHERE username != 'admin' AND role = 'admin'`).run();

console.log('');
console.log('Login credentials:');
console.log('  Username: admin');
console.log('  Password: admin123');

db.close();
