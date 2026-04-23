export interface Street {
  id: string;
  name: string;
  neighborhood: string | null;
  cep: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StreetCreate {
  name: string;
  neighborhood?: string;
  cep?: string;
}

export interface StreetUpdate {
  name?: string;
  neighborhood?: string;
  cep?: string;
  is_active?: boolean;
}

export interface ClientSummary {
  id: string;
  name: string;
  phone: string | null;
}

export interface ClientInStreet {
  id: string;
  client_id: string;
  house_number: string | null;
  reference: string | null;
  display_order: number;
  client: ClientSummary;
}

export interface ReorderItem {
  client_street_id: string;
  display_order: number;
}
