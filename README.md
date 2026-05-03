# 🐾 E-Shop PDV

Sistema de PDV (Ponto de Venda) e Gestão de Estoque modular, inicialmente configurado para um Pet Shop, mas com arquitetura genérica para qualquer varejo.

## 📋 Índice

- [Stack Técnica](#stack-técnica)
- [Funcionalidades](#funcionalidades)
- [Arquitetura](#arquitetura)
- [Instalação](#instalação)
- [Execução](#execução)
- [Testes](#testes)
- [Estrutura de Pastas](#estrutura-de-pastas)
- [API IPC](#api-ipc)
- [Licença](#licença)

## 🛠 Stack Técnica

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **TypeScript** | 5.7+ | Linguagem principal (Strict Mode) |
| **Electron** | 33+ | Framework desktop multiplataforma |
| **SQLite** | 3 | Banco de dados local com WAL mode |
| **better-sqlite3** | 11.6+ | Driver SQLite síncrono e de alta performance |
| **Vite** | 6+ | Build tool e dev server do renderer |
| **Vitest** | 3+ | Testes unitários |
| **bcryptjs** | 2.4+ | Hash de senhas (bcrypt) |

## ✨ Funcionalidades

### 🔐 Dashboard Admin
- Proteção por senha com hash bcrypt
- CRUD completo de produtos com metadados JSONB
- Gestão de categorias hierárquicas
- Visualização de relatórios de vendas
- Indicadores em tempo real (vendas hoje, estoque baixo, etc.)

### 🛒 Sistema de Caixa (POS)
- Interface otimizada para rapidez de atendimento
- Busca por nome ou leitura de código de barras/SKU
- Carrinho com controle de quantidade
- Baixa automática no estoque via transações ACID
- Suporte a múltiplas formas de pagamento (Dinheiro, Crédito, Débito, PIX)

### 📦 Gestão de Estoque
- Controle de entrada e saída de produtos
- Alertas de estoque baixo e sem estoque
- Produtos com metadados extensíveis via JSONB
- Índices binários em campos críticos (sku, id, name) para alta performance

## 🏗 Arquitetura

### Padrão Strategy para Metadados
O sistema utiliza uma coluna `data` do tipo JSONB na tabela `products`, permitindo atributos variados por tipo de negócio:

```typescript
// Pet Shop
{ weight: 15, flavor: "frango", breed: "todos" }

// Vestuário
{ size: "M", color: "azul", material: "algodão" }

// Eletrônicos
{ brand: "Philips", warranty_months: 12, voltage: "110V" }
```

### IPC Seguro
A comunicação entre processos utiliza `contextBridge` do Electron, expondo apenas métodos necessários ao renderer:

```typescript
// Preload (processo seguro)
contextBridge.exposeInMainWorld('electronAPI', {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  findAllProducts: () => ipcRenderer.invoke('product:findAll'),
  createSale: (items, paymentMethod) => ipcRenderer.invoke('sale:create', items, paymentMethod),
  // ...
});
```

### Transações ACID
Todas as operações de venda utilizam transações SQLite para garantir consistência:

```typescript
const transaction = this.db.transaction((items) => {
  // 1. Validar estoque
  // 2. Inserir venda
  // 3. Inserir itens da venda
  // 4. Deduzir estoque
  // Tudo ou nada - rollback automático em caso de erro
});
```

## 📥 Instalação

### Pré-requisitos
- Node.js 20+ 
- npm ou yarn
- Python 3 (para compilação do better-sqlite3)
- Build tools do sistema operacional (gcc/make no Linux, Visual Studio Build Tools no Windows)

### Passos

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/eshop-pdv.git
cd eshop-pdv

# Instale as dependências
npm install

# Compile o TypeScript
npm run build
```

## 🚀 Execução

### Modo Desenvolvimento
```bash
# Inicia o Vite (renderer) e o Electron (main) simultaneamente
npm run dev
```

### Modo Produção
```bash
# Build completo
npm run build

# Inicia o aplicativo
npm start
```

### Build do Instalador
```bash
# Gera o instalador para a plataforma atual
npm run electron:build
```

## 🧪 Testes

O projeto utiliza **Vitest** para testes unitários. Os testes cobrem:

- ✅ Criação de produtos com JSONB
- ✅ Busca por SKU e nome
- ✅ Transações de venda (ACID)
- ✅ Rollback em estoque insuficiente
- ✅ Cálculo de totais
- ✅ Relatórios de vendas
- ✅ Autenticação com bcrypt
- ✅ Metadados extensíveis (Pet Shop, Vestuário, Eletrônicos)

```bash
# Executar todos os testes
npm test

# Modo watch (durante desenvolvimento)
npm run test:watch
```

### Exemplo de Teste - Transação de Venda

```typescript
it('should create a sale and deduct stock (ACID transaction)', () => {
  const product = productService.create({
    sku: 'PET-100',
    name: 'Ração Premium',
    price: 89.90,
    stock: 50,
    data: { weight: 15, flavor: 'frango' },
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

## 📁 Estrutura de Pastas

```
eshop-pdv/
├── package.json              # Dependências e scripts
├── tsconfig.json             # Configuração TypeScript
├── vite.config.ts            # Configuração Vite (renderer)
├── vitest.config.ts          # Configuração Vitest
├── README.md                 # Documentação (PT-BR)
├── README_EN.md              # Documentação (English)
│
├── src/
│   ├── database/
│   │   └── connection.ts     # Conexão SQLite + migrações
│   │
│   ├── main/
│   │   └── main.ts           # Processo principal Electron + IPC handlers
│   │
│   ├── preload/
│   │   └── preload.ts        # Bridge segura entre main e renderer
│   │
│   ├── renderer/
│   │   ├── index.html        # Interface principal
│   │   ├── js/
│   │   │   └── app.js        # Lógica do frontend (SPA)
│   │   └── styles/
│   │       └── main.css      # Estilos globais
│   │
│   ├── services/
│   │   ├── auth.service.ts   # Autenticação (bcrypt)
│   │   ├── product.service.ts # CRUD produtos + estoque
│   │   ├── sale.service.ts   # Transações de venda (ACID)
│   │   └── category.service.ts # CRUD categorias
│   │
│   └── types/
│       └── index.ts          # Interfaces TypeScript
│
└── tests/
    └── sale.test.ts          # Testes unitários (Vitest)
```

## 🔌 API IPC

### Autenticação
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `auth:login` | `{ username, password }` | `{ success, user?, message? }` |

### Produtos
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `product:findAll` | - | `Product[]` |
| `product:findById` | `id: number` | `Product \| undefined` |
| `product:findBySku` | `sku: string` | `Product \| undefined` |
| `product:search` | `query: string` | `Product[]` |
| `product:create` | `Omit<Product, 'id' \| 'created_at' \| 'updated_at'>` | `Product` |
| `product:update` | `id: number, Partial<Product>` | `Product \| undefined` |
| `product:delete` | `id: number` | `boolean` |
| `product:getLowStock` | `threshold?: number` | `Product[]` |

### Vendas
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `sale:create` | `items[], paymentMethod` | `Sale \| null` |
| `sale:findRecent` | `limit?: number` | `Sale[]` |
| `sale:getReport` | `startDate?, endDate?` | `SaleReport` |
| `sale:getTodaySales` | - | `Sale[]` |
| `sale:getTodayRevenue` | - | `number` |

### Categorias
| Canal | Parâmetros | Retorno |
|-------|-----------|---------|
| `category:findAll` | - | `Category[]` |
| `category:create` | `Omit<Category, 'id' \| 'created_at'>` | `Category` |
| `category:update` | `id: number, Partial<Category>` | `Category \| undefined` |
| `category:delete` | `id: number` | `boolean` |

## 🗄 Banco de Dados

### Schema

```sql
-- Produtos com JSONB
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

-- Índices binários para alta performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_id ON products(id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category_id);

-- Categorias
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  parent_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Vendas
CREATE TABLE sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  items TEXT NOT NULL,  -- JSON array
  total REAL NOT NULL,
  payment_method TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Itens de venda (denormalizado para relatórios)
CREATE TABLE sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Segurança

- **Context Isolation**: Ativado (`contextIsolation: true`)
- **Node Integration**: Desativado (`nodeIntegration: false`)
- **Preload Script**: Único ponto de comunicação IPC
- **CSP**: Content Security Policy configurado no HTML
- **Senhas**: Hash com bcrypt (salt rounds: 10)
- **SQL Injection**: Prevenido via prepared statements do better-sqlite3

## 📦 Build

### Configurações Suportadas
- **Windows**: NSIS installer
- **Linux**: AppImage
- **macOS**: DMG (requer ajustes no build)

### Variáveis de Ambiente
```bash
NODE_ENV=development  # Modo dev (DevTools aberto)
NODE_ENV=production   # Modo produção
```

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo [LICENSE](LICENSE) para detalhes.

---
