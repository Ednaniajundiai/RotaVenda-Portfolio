export interface UserAdmin {
  id: string;
  name: string;
  email: string;
  role: "GERENTE" | "VENDEDOR";
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  name: string;
  email: string;
  password: string;
  role: "GERENTE" | "VENDEDOR";
}

export interface UserUpdate {
  name?: string;
  email?: string;
  role?: "GERENTE" | "VENDEDOR";
  is_active?: boolean;
}

export interface UserPasswordUpdate {
  password: string;
}
