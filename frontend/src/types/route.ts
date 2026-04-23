export type RouteStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED";
export type RouteStreetStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";

export interface RouteStreetSummary {
  id: string;
  street_id: string;
  street_name: string;
  street_neighborhood: string | null;
  visit_order: number;
  status: RouteStreetStatus;
  started_at: string | null;
  completed_at: string | null;
}

export interface Route {
  id: string;
  name: string;
  seller_id: string;
  seller_name: string;
  route_date: string;
  status: RouteStatus;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  route_streets: RouteStreetSummary[];
}

export interface RouteCreate {
  name: string;
  route_date: string;
  notes?: string;
}

export interface RouteUpdate {
  name?: string;
  notes?: string;
}

export interface RouteStreetCreate {
  street_id: string;
  visit_order?: number;
}

export interface ClientInRouteStreet {
  client_street_id: string;
  client_id: string;
  name: string;
  phone: string | null;
  house_number: string | null;
  reference: string | null;
  display_order: number;
  balance: number;
}

export interface RouteStreetDetail {
  id: string;
  route_id: string;
  street_id: string;
  street_name: string;
  street_neighborhood: string | null;
  visit_order: number;
  status: RouteStreetStatus;
  started_at: string | null;
  completed_at: string | null;
  clients: ClientInRouteStreet[];
}
