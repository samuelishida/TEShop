# 🐾 E-Shop PDV

Modular POS (Point of Sale) and Inventory Management system, initially configured for a Pet Shop, but with generic architecture for any retail business.

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Running](#running)
- [Tests](#tests)
- [Folder Structure](#folder-structure)
- [IPC API](#ipc-api)
- [License](#license)

## 🛠 Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **TypeScript** | 5.7+ | Main language (Strict Mode) |
| **Electron** | 33+ | Cross-platform desktop framework |
| **SQLite** | 3 | Local database with WAL mode |
| **better-sqlite3** | 11.6+ | Synchronous, high-performance SQLite driver |
| **Vite** | 6+ | Build tool and renderer dev server |
| **Vitest** | 3+ | Unit testing |
| **bcryptjs** | 2.4+ | Password hashing (bcrypt) |

## ✨ Features

### 🔐 Admin Dashboard
- Password protection with bcrypt hashing
- Complete product CRUD with JSONB metadata
- Hierarchical category management
- Sales reports visualization
- Real-time indicators (today's sales, low stock, etc.)

### 🛒 POS System (Point of Sale)
- Optimized interface for fast checkout
- Search by name or barcode/SKU scanning
- Cart with quantity control
- Automatic stock deduction via ACID transactions
- Multiple payment methods support (Cash, Credit, Debit, PIX)

### 📦 Inventory Management
- Product in/out control
- Low stock and out-of-stock alerts
- Products with extensible metadata via JSONB
- Binary indexes on critical fields (sku, id, name) for high performance

## 🏗 Architecture

### Strategy Pattern for Metadata
The system uses a `data` column of type JSONB in the `products` table, allowing varied attributes per business type:

```typescript
// Pet Shop
{ weight: 15, flavor: "chicken", breed: "all" }

// Clothing
{ size: "M", color: "blue", material: "cotton" }

// Electronics
{ brand: "Philips", warranty_months: 12, voltage: "110V" }
```

### Secure IPC
Inter-process communication uses Electron's `contextBridge`, exposing only necessary methods to the renderer:

```typescript
// Preload (secure process)
contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  findAllProducts: () => ipcRenderer.invoke('product:findAll'),
  createSale: (items, paymentMethod) => ipcRenderer.invoke('sale:create', items, paymentMethod),
  // ...
});
```

### ACID Transactions
All sale operations use SQLite transactions to ensure consistency:

```typescript
const transaction = this.db.transaction((items) => {
  // 1. Validate stock
  // 2. Insert sale
  // 3. Insert sale items
  // 4. Deduct stock
  // All or nothing - automatic rollback on error
});
```

## 📥 Installation

### Prerequisites
- Node.js 20+
- npm or yarn
- Python 3 (for better-sqlite3 compilation)
- OS build tools (gcc/make on Linux, Visual Studio Build Tools on Windows)

### Steps

```bash
# Clone the repository
git clone https://github.com/your-username/eshop-pdv.git
cd eshop-pdv

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

## 🚀 Running

### Development Mode
```bash
# Starts Vite (renderer) and Electron (main) simultaneously
npm run dev
```

### Production Mode
```bash
# Complete build
npm run build

# Start the application
npm start
```

### Installer Build
```bash
# Generates installer for current platform
npm run electron:build
```

## 🧪 Tests

The project uses **Vitest** for unit testing. Tests cover:

- ✅ Product creation with JSONB
- ✅ SKU and name search
- ✅ Sale transactions (ACID)
- ✅ Rollback on insufficient stock
- ✅ Total calculation
- ✅ Sales reports
- ✅ bcrypt authentication
- ✅ Extensible metadata (Pet Shop, Clothing, Electronics)

```bash
# Run all tests
npm test

# Watch mode (during development)
npm run test:watch
```

### Test Example - Sale Transaction

```typescript
it('should create a sale and deduct stock (ACID transaction)', () => {
  const product = productService.create({
    sku: 'PET-100',
    name: 'Premium Dog Food',
    price: 89.90,
    stock: 50,
    data: { weight: 15, flavor: 'chicken' },
  });

  const items = [
    { product_id: product.id, quantity: 2, unit_price: 89.90 },
  ];

  const sale = saleService.createSale(items, 'cash');

  expect(sale).toBeDefined();
  expect(sale?.total).toBe(179.80);
  
  const updated = productService.findById(product.id);
  expect(updated?.stock).toBe(48); // 50 - 2
});
```

## 📁 Folder Structure

```
eshop-pdv/
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite configuration (renderer)
├── vitest.config.ts          # Vitest configuration
├── README.md                 # Documentation (PT-BR)
├── README_EN.md              # Documentation (English)
│
├── src/
│   ├── database/
│   │   └── connection.ts     # SQLite connection + migrations
│   │
│   ├── main/
│   │   └── main.ts           # Electron main process + IPC handlers
│   │
│   ├── preload/
│   │   └── preload.ts        # Secure bridge between main and renderer
│   │
│   ├── renderer/
│   │   ├── index.html        # Main interface
│   │   ├── js/
│   │   │   └── app.js        # Frontend logic (SPA)
│   │   └── styles/
│   │       └── main.css      # Global styles
│   │
│   ├── services/
│   │   ├── auth.service.ts   # Authentication (bcrypt)
│   │   ├── product.service.ts # Product CRUD + stock
│   │   ├── sale.service.ts   # Sale transactions (ACID)
│   │   └── category.service.ts # Category CRUD
│   │
│   └── types/
│       └── index.ts          # TypeScript interfaces
│
└── tests/
    └── sale.test.ts          # Unit tests (Vitest)
```

## 🔌 IPC API

### Authentication
| Channel | Parameters | Return |
|---------|-----------|--------|
| `auth:login` | `{ username, password }` | `{ success, user?, message? }` |

### Products
| Channel | Parameters | Return |
|---------|-----------|--------|
| `product:findAll` | - | `Product[]` |
| `product:findById` | `id: number` | `Product \| undefined` |
| `product:findBySku` | `sku: string` | `Product \| undefined` |
| `product:search` | `query: string` | `Product[]` |
| `product:create` | `Omit<Product, 'id' \| 'created_at' \| 'updated_at'>` | `Product` |
| `product:update` | `id: number, Partial<Product>` | `Product \| undefined` |
| `product:delete` | `id: number` | `boolean` |
| `product:getLowStock` | `threshold?: number` | `Product[]` |

### Sales
| Channel | Parameters | Return |
|---------|-----------|--------|
| `sale:create` | `items[], paymentMethod` | `Sale \| null` |
| `sale:findRecent` | `limit?: number` | `Sale[]` |
| `sale:getReport` | `startDate?, endDate?` | `SaleReport` |
| `sale:getTodaySales` | - | `Sale[]` |
| `sale:getTodayRevenue` | - | `number` |

### Categories
| Channel | Parameters | Return |
|---------|-----------|--------|
| `category:findAll` | - | `Category[]` |
| `category:create` | `Omit<Category, 'id' \| 'created_at'>` | `Category` |
| `category:update` | `id: number, Partial<Category>` | `Category \| undefined` |
| `category:delete` | `id: number` | `boolean` |

## 🗄 Database

### Schema

```sql
-- Products with JSONB
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER,
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',  -- JSONB
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Binary indexes for high performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_id ON products(id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);

-- Categories
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Sales
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  items TEXT NOT NULL,  -- JSON array
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sale items (denormalized for reports)
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

-- Admin users
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security

- **Context Isolation**: Enabled (`contextIsolation: true`)
- **Node Integration**: Disabled (`nodeIntegration: false`)
- **Preload Script**: Single IPC communication point
- **CSP**: Content Security Policy configured in HTML
- **Passwords**: Hashed with bcrypt (salt rounds: 10)
- **SQL Injection**: Prevented via better-sqlite3 prepared statements

## 📦 Build

### Supported Configurations
- **Windows**: NSIS installer
- **Linux**: AppImage
- **macOS**: DMG (requires build adjustments)

### Environment Variables
```bash
NODE_ENV=development  # Dev mode (DevTools open)
NODE_ENV=production   # Production mode
```

## 🤝 Contributing

1. Fork the project
2. Create a branch (`git checkout -b feature/new-feature`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

