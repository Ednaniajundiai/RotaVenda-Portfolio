export type StockStatus = "OK" | "LOW" | "OUT";

export interface Product {
  id: string;
  name: string;
  category: string;
  unit_measure: string;
  price: number;
  current_stock: number;
  min_stock: number;
  stock_status: StockStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductCreate {
  name: string;
  category: string;
  unit_measure: string;
  price: number;
  current_stock?: number;
  min_stock?: number;
}

export interface ProductUpdate {
  name?: string;
  category?: string;
  unit_measure?: string;
  price?: number;
  current_stock?: number;
  min_stock?: number;
  is_active?: boolean;
}
