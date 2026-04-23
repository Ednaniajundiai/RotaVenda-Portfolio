export interface RouteTemplateStreetItem {
  id: string;
  street_id: string;
  street_name: string;
  street_neighborhood: string | null;
  visit_order: number;
}

export interface RouteTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  streets: RouteTemplateStreetItem[];
}

export interface RouteTemplateCreate {
  name: string;
  description?: string;
}

export interface RouteTemplateUpdate {
  name?: string;
  description?: string;
  is_active?: boolean;
}

export interface RouteTemplateStreetAdd {
  street_id: string;
  visit_order?: number;
}

export interface RouteTemplateStreetReorderItem {
  id: string;
  visit_order: number;
}
