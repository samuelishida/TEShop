import { z } from 'zod';

// --- Auth Schemas ---
export const LoginSchema = z.object({
  username: z.string().min(1, 'Username é obrigatório').max(50, 'Máximo 50 caracteres'),
  password: z.string().min(1, 'Senha é obrigatória').max(100, 'Máximo 100 caracteres'),
});

// --- Product Schemas ---
export const ProductCreateSchema = z.object({
  sku: z.string().min(1, 'SKU é obrigatório').max(50, 'Máximo 50 caracteres'),
  name: z.string().min(1, 'Nome é obrigatório').max(200, 'Máximo 200 caracteres'),
  category_id: z.number().int().positive().optional(),
  price: z.number().min(0, 'Preço não pode ser negativo'),
  stock: z.number().int().min(0, 'Estoque não pode ser negativo'),
  data: z.record(z.string(), z.any()).default({}),
});

export const ProductUpdateSchema = z.object({
  sku: z.string().min(1).max(50, 'Máximo 50 caracteres').optional(),
  name: z.string().min(1).max(200, 'Máximo 200 caracteres').optional(),
  category_id: z.number().int().positive().optional().nullable(),
  price: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  data: z.record(z.string(), z.any()).optional(),
});

// --- Sale Schemas ---
export const SaleItemSchema = z.object({
  product_id: z.number().int().positive(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
});

export const SaleCreateSchema = z.object({
  items: z.array(SaleItemSchema).min(1, 'Ao menos um item é obrigatório'),
  paymentMethod: z.enum(['cash', 'credit', 'debit', 'pix'], { message: 'Forma de pagamento inválida' }),
});

export const SaleFindByDateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato YYYY-MM-DD'),
});

// --- Category Schemas ---
export const CategoryCreateSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo 100 caracteres'),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  parent_id: z.number().int().positive().optional().nullable(),
});

export const CategoryUpdateSchema = z.object({
  name: z.string().min(1).max(100, 'Máximo 100 caracteres').optional(),
  description: z.string().max(500, 'Máximo 500 caracteres').optional(),
  parent_id: z.number().int().positive().optional().nullable(),
});

// --- User Schemas ---
export const CreateCashierSchema = z.object({
  username: z.string().min(3, 'Mínimo 3 caracteres').max(50, 'Máximo 50 caracteres').regex(/^[a-zA-Z0-9_]+$/, 'Apenas letras, números e underscore'),
  password: z.string().min(4, 'Mínimo 4 caracteres').max(100, 'Máximo 100 caracteres'),
});

// --- Generic Schemas ---
export const IdSchema = z.object({
  id: z.number().int().positive(),
});

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const LowStockSchema = z.object({
  threshold: z.preprocess(
    (v) => (v === undefined ? 10 : typeof v === 'number' ? v : Number(v)),
    z.number().int().min(1).max(10000).optional().default(10)
  ),
});

// --- Type exports from schemas ---
export type LoginInput = z.infer<typeof LoginSchema>;
export type ProductCreateInput = z.infer<typeof ProductCreateSchema>;
export type ProductUpdateInput = z.infer<typeof ProductUpdateSchema>;
export type SaleCreateInput = z.infer<typeof SaleCreateSchema>;
export type CategoryCreateInput = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof CategoryUpdateSchema>;
export type CreateCashierInput = z.infer<typeof CreateCashierSchema>;
