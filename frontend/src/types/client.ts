export interface Client {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  opening_balance: number;
  saldo: number;
  primary_neighborhood: string | null;
  primary_street: string | null;
}

export interface ClientCreate {
  name: string;
  phone?: string;
  notes?: string;
  opening_balance?: number;
}

export interface ClientUpdate {
  name?: string;
  phone?: string;
  notes?: string;
  is_active?: boolean;
  opening_balance?: number;
}

export interface ClientBalance {
  client_id: string;
  saldo: number;
}

export interface ClientStreetCreate {
  street_id: string;
  house_number?: string;
  reference?: string;
  display_order?: number;
}

export interface StreetSummary {
  id: string;
  name: string;
  neighborhood: string | null;
  cep: string | null;
}

export interface StreetInClient {
  id: string;
  street_id: string;
  house_number: string | null;
  reference: string | null;
  display_order: number;
  street: StreetSummary;
}

export interface StatementEntry {
  id: string;
  type: "sale" | "payment";
  date: string;
  amount: number;
  description: string | null;
  payment_mode: string | null;
  created_at: string;
  installments_count: number | null;
  installments_pending: number | null;
}

export interface ClientStatement {
  client_id: string;
  client_name: string;
  saldo: number;
  entries: StatementEntry[];
}
