# 🐾 E-Shop PDV

Sistema de PDV (Ponto de Venda) e Gestão de Estoque modular para varejo. Construído com Electron + SQLite + TypeScript.

> **Stack:** Electron 41 · SQLite (better-sqlite3) · TypeScript strict · Vite 6 · Vitest 3 · Zod 4

> **v2.0** — Autenticação em todos os endpoints, cancelamento de vendas, sync autenticado, CSP restritiva, logging estruturado.

---

## 📋 Índice

- [Funcionalidades](#funcionalidades)
- [Instalação](#instalação)
- [Execução](#execução)
- [Testes](#testes)
- [Arquitetura](#arquitetura)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [API IPC](#api-ipc)
- [Banco de Dados](#banco-de-dados)
- [Segurança](#segurança)
- [Build](#build)

---

## ✨ Funcionalidades

### 🔐 Dashboard Admin
- Login com hash bcrypt + autenticação por sessão (token JWT-like)
- **Auth middleware em todos os IPC handlers** — token validado antes de cada operação
- **Validação de sessão no restore** — token expirado/revogado rejeitado no frontend
- Proteção contra brute force (5 tentativas, lockout de 15 min)
- CRUD completo de produtos com metadados JSONB extensíveis
- Gestão de categorias hierárquicas
- Gerenciamento de usuários (admin + caixa)
- Visualização de relatórios com paginação
- Indicadores em tempo real (vendas do dia, estoque baixo, receita)
- **Cancelamento de vendas** com restauração automática de estoque

### 🛒 Sistema de Caixa (POS)
- Interface otimizada para atendimento rápido
- Busca por nome, SKU ou código de barras
- Carrinho com controle de quantidade (+, −, remover)
- Baixa automática de estoque via transações ACID
- Múltiplas formas de pagamento (Dinheiro, Crédito, Débito, PIX)

### 📦 Gestão de Estoque
- Cadastro de produtos com SKU único e metadados JSONB
- **Importação em massa via CSV** — upload de arquivo ou colar texto, com template para download
- Categorias hierárquicas
- Alertas de estoque baixo (configurável)
- Índices binários para alta performance em campos críticos

### 🔄 Sincronização LAN
- Admin inicia servidor HTTP na porta 38475
- **Autenticação HMAC-SHA256** no endpoint `/sync` — token gerado por instância
- Caixas sincronizam dados a cada 10 minutos (polling) com token de autenticação
- Sync não-destrutivo: estoque local preservado em caso de conflito (upsert/merge)
- Endereço do admin e sync token salvos persistentemente no banco

### 🌙 Interface
- Dark mode com toggle na sidebar
- Layout responsivo adaptado para PDV
- Tema CSS Variables — fácil de customizar

---

## 📥 Instalação

### Pré-requisitos
- Node.js 20+
- npm ou yarn
- Python 3 (para compilar better-sqlite3)
- Build tools: `gcc`/`make` (Linux), Visual Studio Build Tools (Windows)

### Passos

```bash
git clone https://github.com/seu-usuario/eshop-pdv.git
cd eshop-pdv
npm install
```

### Compile o native module (better-sqlite3)

> ⚠️ **Importante:** `better-sqlite3` é um módulo nativo C++ que precisa ser compilado separadamente para **Electron** e para **Node.js regular**. Após `npm install`, o `postinstall` já compila para Electron. Se você rodar `npm test`, precisa recompilar para Node.js. Depois dos testes, recompile para Electron antes de rodar `npm run dev`.

```bash
# Após npm install — já compilado para Electron via postinstall
npm run dev

# Para rodar testes (recompila para Node.js regular)
npm run rebuild:node
npm test

# Para voltar a rodar o app (recompila para Electron)
npm run rebuild:electron
npm run dev
```

### Por plataforma (primeira instalação)

```bash
# Linux
sudo apt install build-essential python3
npm install        # já roda electron-rebuild no postinstall

# macOS
xcode-select --install
npm install

# Windows (PowerShell como admin)
npm install
```

---

## 🚀 Execução

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Modo desenvolvimento (Vite + Electron com DevTools) |
| `npm run build` | Compila TypeScript + bundla renderer |
| `npm start` | Executa o app em modo produção |
| `npm test` | Executa todos os testes (Vitest) |
| `npm run test:watch` | Modo watch durante desenvolvimento |
| `npm run rebuild:node` | Recompila better-sqlite3 para Node.js (testes) |
| `npm run rebuild:electron` | Recompila better-sqlite3 para Electron (app) |
| `npm run reset-admin` | Reseta senha do admin para `admin123` |
| `npm run electron:build` | Gera AppImage/EXE/DMG via electron-builder |

### Modo Desenvolvimento
```bash
npm run dev
```
Abre Vite na porta 5173 e Electron com DevTools.

### Modo Produção
```bash
npm run build        # Compila TypeScript + bundla renderer
npm start            # Executa o app
```

### Resetar senha do admin
```bash
npm run reset-admin
# Saída: "Usuário admin criado. Senha: admin123"
```

---

## 🧪 Testes

```bash
npm test          # Executa todos os testes (Vitest)
npm run test:watch  # Modo watch durante desenvolvimento
```

**Cobertura atual:** 25 testes — ProductService, SaleService (ACID + cancelamento), AuthService (bcrypt + sessions), CategoryService.

```
✓ 25 tests passed
  ✓ auth.service    — 5 tests (login, logout, brute-force, session expiry)
  ✓ product.service — 5 tests (CRUD, search, low-stock)
  ✓ sale.service    — 7 tests (ACID transaction, rollback, reports, cancellation)
  ✓ category.service — 4 tests (CRUD)
  ✓ JSONB metadata  — 4 tests (pet shop, clothing, electronics, update)
```

---

## 🏗 Arquitetura

### Camadas

```
┌─────────────────────────────────────────────────────┐
│  Renderer (Vanilla JS — modules/)                   │
│  safe-dom.ts · 13 modules factory                   │
│  textContent everywhere (XSS protection)             │
└──────────────────┬──────────────────────────────────┘
                   │ window.electronAPI (contextBridge)
┌──────────────────▼──────────────────────────────────┐
│  Preload (IPC bridge — apenas métodos necessários)    │
└──────────────────┬──────────────────────────────────┘
                   │ ipcRenderer.invoke / ipcMain.handle
┌──────────────────▼──────────────────────────────────┐
│  Main Process                                           │
│  ├── IPC Handlers (validação Zod)                      │
│  ├── Services (auth, product, sale, category, sync)    │
│  └── Database (migrations versionadas)                 │
└──────────────────────────────────────────────────────┘
```

### Fluxo de uma venda

```
POS.loadProducts()
  → window.electronAPI.findAllProducts({ page: 1, limit: 50 })
  → ipcRenderer.invoke('product:findAll', { page: 1, limit: 50 })
  → productService.findAll({ page: 1, limit: 50 })
  → SQLite transaction (ACID)
  ← { data: Product[], total: number }
  ← Carrinho renderizado com textContent
```

### Sessão e segurança

```
Login → authService.login()
  → bcrypt.compareSync(password, hash)
  → SessionManager.create(user)
  → Token JWT-like salvo no banco + retornado ao renderer
  → renderer guarda em localStorage ('session_token')
  → Todo IPC subsequente: token como primeiro argumento
  → requireAuth() valida token antes de processar cada handler
  → restoreSession() valida token com auth:validate no backend
  → Brute-force: 5 tentativas → 15min lockout
  → Sync: HMAC-SHA256 token no header Authorization
```

---

## 📁 Estrutura de Pastas

```
eshop-pdv/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
│
├── src/
│   ├── database/
│   │   ├── connection.ts       # DatabaseManager + seed genérico
│   │   └── migrations.ts       # ✅ V1-V4 versionadas (cascade, status, upsert)
│   │
│   ├── main/
│   │   └── main.ts             # IPC handlers + Zod validation
│   │
│   ├── preload/
│   │   └── preload.ts           # contextBridge — electronAPI
│   │
│   ├── renderer/
│   │   ├── index.html           # SPA entry point
│   │   ├── js/
│   │   │   ├── app.js           # Bootstrap + Session + auth restore
│   │   │   └── modules/         # ✅ 13 módulos factory (todos com Session)
│   │   │       ├── auth.js
│   │   │       ├── cart.js
│   │   │       ├── categories.js
│   │   │       ├── dashboard.js
│   │   │       ├── modal.js
│   │   │       ├── navigation.js
│   │   │       ├── pos.js
│   │   │       ├── products.js
│   │   │       ├── reports.js
│   │   │       ├── sync.js
│   │   │       ├── toast.js
│   │   │       └── users.js
│   │   └── styles/
│   │       └── main.css         # CSS Variables + dark mode
│   │
│   ├── services/
│   │   ├── auth.service.ts     # bcrypt + rate limiting + sessions
│   │   ├── category.service.ts # CRUD + paginação
│   │   ├── logger.service.ts   # ✅ Structured logging (DEBUG/INFO/WARN/ERROR)
│   │   ├── product.service.ts  # CRUD + search + paginação
│   │   ├── sale.service.ts     # ACID transactions + cancelamento + relatórios
│   │   ├── session.service.ts  # Token management + cleanup
│   │   └── sync.service.ts     # ✅ HMAC auth + upsert merge + host discovery
│   │
│   ├── types/
│   │   └── index.ts            # Product, Sale, Category, User, Session
│   │
│   └── validation/
│       ├── index.ts            # extractZodError()
│       └── schemas.ts          # Zod v4 schemas para todos os IPC
│
├── scripts/
│   └── reset-admin.js         # CLI para resetar admin
│
└── tests/
    └── sale.test.ts           # 26 testes Vitest
```

---

## 🔌 API IPC

### Autenticação
| Canal | Parâmetros | Retorno | Auth |
|-------|-----------|---------|------|
| `auth:login` | `{ username, password }` | `{ success, user, token?, message? }` | Público |
| `auth:logout` | `token` | `{ success }` | Público |
| `auth:validate` | `token` | `{ valid, userId? }` | Público |
| `auth:resetAdmin` | — | `{ success }` | Público |
| `auth:createCashier` | `token, username, password` | `{ success, message }` | 🔒 |
| `auth:listUsers` | `token` | `User[]` | 🔒 |
| `auth:deleteUser` | `token, userId` | `{ success }` | 🔒 |

### Produtos (🔒 todos requerem token)
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `product:findAll` | `token, { page?, limit? }` | `PaginatedResult<Product>` |
| `product:findById` | `token, id` | `Product \| null` |
| `product:findBySku` | `token, sku` | `Product \| null` |
| `product:findByCategory` | `token, categoryId, { page?, limit? }` | `PaginatedResult<Product>` |
| `product:search` | `token, query, { page?, limit? }` | `PaginatedResult<Product>` |
| `product:create` | `token, ProductInput` | `Product` |
| `product:update` | `token, id, Partial<ProductInput>` | `Product` |
| `product:delete` | `token, id` | `boolean` |
| `product:getLowStock` | `token, threshold?` | `Product[]` |
| `product:getOutOfStock` | `token` | `Product[]` |

### Vendas (🔒 todos requerem token)
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `sale:create` | `token, items[], paymentMethod` | `Sale` |
| `sale:findRecent` | `token, { limit? }` | `PaginatedResult<Sale>` |
| `sale:findSalesByDate` | `token, startDate, endDate, { page?, limit? }` | `PaginatedResult<Sale>` |
| `sale:getReport` | `token, startDate?, endDate?` | `SaleReport` |
| `sale:getTodaySales` | `token` | `Sale[]` |
| `sale:getTodayRevenue` | `token` | `number` |
| `sale:cancel` | `token, saleId` | `{ success, message }` |

### Categorias (🔒 todos requerem token)
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `category:findAll` | `token, { page?, limit? }` | `PaginatedResult<Category>` |
| `category:create` | `token, CategoryInput` | `Category` |
| `category:update` | `token, id, Partial<CategoryInput>` | `Category` |
| `category:delete` | `token, id` | `boolean` |

### Sessão
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `auth:validate` | `token` | `{ valid, userId? }` |

### Sync (LAN) (🔒 todos requerem token)
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `sync:startServer` | `token` | `{ success, isHost, message, token? }` |
| `sync:stopServer` | `token` | `{ success, message }` |
| `sync:isHost` | `token` | `boolean` |
| `sync:startClient` | `token, address` | `{ success, message }` |
| `sync:stopClient` | `token` | `{ success, message }` |
| `sync:pullOnce` | `token, address` | `{ success, message }` |
| `sync:getHostAddress` | `token` | `string \| null` |
| `sync:saveHostAddress` | `token, address` | `{ success }` |
| `sync:checkHost` | `token, address` | `{ success, reachable }` |

---

## 🗄 Banco de Dados

### Schema (SQLite)

```sql
-- Produtos com metadados JSONB
CREATE TABLE products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  price REAL NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índices para alta performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_id ON products(id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);

-- Categorias hierárquicas
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Vendas (coluna items removida — dados normalizados em sale_items)
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',  -- 'completed' | 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Itens de venda (para relatórios)
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  total REAL NOT NULL
);

-- Usuários admin
CREATE TABLE admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'caixa',  -- 'admin' | 'caixa'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessões ativas
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_token ON sessions(token);

-- Controle de versão das migrações
CREATE TABLE db_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Estado da aplicação (sync host, etc)
CREATE TABLE app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Log de sincronizações
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  synced_at TEXT NOT NULL,
  success INTEGER NOT NULL,
  message TEXT,
  records_synced INTEGER DEFAULT 0
);
```

### Migrações Versionadas

```typescript
// migrations.ts — aplicado em ordem, cada versão é um bloco
const MIGRATIONS = [
  { version: 1, description: 'Versão inicial — todas as tabelas', ... },
  { version: 2, description: 'Adiciona sessions com token e expiry', ... },
  { version: 3, description: 'Adiciona app_state para sync', ... },
  { version: 4, description: 'Cascade deletes, sale status, remove items JSON, auth middleware', ... },
];
```

---

## 🔒 Segurança

| Medida | Implementação |
|--------|-------------|
| Context Isolation | `contextIsolation: true` — renderer não acessa Node nem Electron diretamente |
| Node Integration | `nodeIntegration: false` |
| CSP | `script-src 'self'` — sem `unsafe-inline` |
| IPC Bridge | `contextBridge.exposeInMainWorld` — apenas métodos necessários |
| **Auth middleware** | `requireAuth()` valida token em **todos** os handlers protegidos |
| **Session restore** | `restoreSession()` chama `auth:validate` no backend — token expirado rejeitado |
| Validação de entrada | **Zod v4** em todos os IPC handlers do main |
| Sanitização de output | `textContent` em vez de `innerHTML` em todos os módulos |
| Senhas | `bcryptjs` com salt de 12 rounds |
| Rate limiting | 5 tentativas de login → 15 min de lockout |
| Sessões | Token com TTL de 7 dias, cleanup automático |
| SQL Injection | Prepared statements (`db.prepare()`) — nunca concatenação |
| **Sync auth** | HMAC-SHA256 no endpoint `/sync` — token por instância |
| Sync passwords | Hash **nunca** sai do admin — sync usa só `id, username, role` |
| Sync conflitos | UpsertMerge preserva estoque local em caso de conflito |
| **Cancelamento** | Vendas podem ser canceladas com restauração de estoque |
| **Logging** | Logger estruturado com níveis DEBUG/INFO/WARN/ERROR |
| **Foreign keys** | `ON DELETE CASCADE` em sale_items e sessions; `ON DELETE SET NULL` em products.category_id |

---

## 📦 Build

### Gerar instalador AppImage (Linux)

```bash
npm run build && npm run electron:build
# Output: release/eshop-pdv_1.0.0_amd64.AppImage
```

### Variáveis de ambiente

```bash
NODE_ENV=development   # DevTools aberto, verbose logs
NODE_ENV=production    # Produção, logs minimalistas
```

---

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

MIT — use livremente.
