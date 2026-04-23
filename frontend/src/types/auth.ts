export interface User {
  id: string;
  name: string;
  email: string;
  role: "GERENTE" | "VENDEDOR";
  is_active: boolean;
  created_at: string;
}

export interface TokenWithUser {
  access_token: string;
  token_type: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
