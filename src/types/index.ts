// Product metadata interface - extensible via JSONB
export interface ProductMetadata {
  // Pet Shop specific
  weight?: number;
  breed?: string;
  flavor?: string;
  
  // Clothing specific
  size?: string;
  color?: string;
  material?: string;
  
  // Electronics specific
  brand?: string;
  warranty_months?: number;
  voltage?: string;
  
  // Generic
  [key: string]: any;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number;
  price: number;
  stock: number;
  data: ProductMetadata;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number;
  created_at: string;
}

export interface SaleItem {
  product_id: number;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface Sale {
  id: number;
  items: SaleItem[];
  total: number;
  payment_method: string;
  created_at: string;
}

export interface SaleReport {
  total_sales: number;
  total_revenue: number;
  top_products: { name: string; quantity: number; revenue: number }[];
  daily_average: number;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export type UserRole = 'admin' | 'caixa';

export interface AdminUser {
  id: number;
  username: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
}
