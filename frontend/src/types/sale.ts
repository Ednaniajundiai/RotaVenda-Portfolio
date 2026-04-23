export type SaleType = "ROTA" | "LOJA";
export type PaymentMode = "A_VISTA" | "FIADO";
export type InstallmentStatus = "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";

export interface Installment {
  id: string;
  sale_id: string;
  number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  remaining: number;
  status: InstallmentStatus;
  paid_at: string | null;
  created_at: string;
}

export interface InstallmentInput {
  number: number;
  due_date: string;
  amount: number;
}

export interface SaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
}

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  unit_measure: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  client_id: string;
  client_name: string;
  seller_id: string;
  seller_name: string;
  route_street_id: string | null;
  sale_date: string;
  amount: number;
  discount: number;
  subtotal: number;
  description: string | null;
  sale_type: SaleType;
  payment_mode: PaymentMode;
  created_at: string;
  installments: Installment[];
  items: SaleItem[];
}

export interface SaleCreate {
  client_id: string;
  route_street_id?: string;
  sale_date?: string;
  description?: string;
  sale_type: SaleType;
  payment_mode: PaymentMode;
  installments?: InstallmentInput[];
  items: SaleItemInput[];
  discount?: number;
}

export interface SaleUpdate {
  description?: string;
  payment_mode?: PaymentMode;
  discount?: number;
  items?: SaleItemInput[];
  installments?: InstallmentInput[];
}
