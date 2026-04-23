export interface Payment {
  id: string;
  client_id: string;
  client_name: string;
  seller_id: string;
  seller_name: string;
  route_street_id: string | null;
  payment_date: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

export interface InstallmentApplicationInput {
  installment_id: string;
  amount: number;
}

export interface PaymentCreate {
  client_id: string;
  route_street_id?: string;
  payment_date?: string;
  amount: number;
  notes?: string;
  installment_applications?: InstallmentApplicationInput[];
}

export interface PaymentUpdate {
  amount?: number;
  notes?: string;
}
