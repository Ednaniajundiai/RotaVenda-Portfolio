export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "/api/v1";

export const QUERY_KEYS = {
  AUTH_ME: ["auth", "me"],
  CLIENTS: ["clients"],
  CLIENT_NEIGHBORHOODS: ["clients", "neighborhoods"],
  CLIENT_STREETS_FILTER: (neighborhood: string) => [
    "clients",
    "streets-filter",
    neighborhood,
  ],
  CLIENT: (id: string) => ["clients", id],
  CLIENT_BALANCE: (id: string) => ["clients", id, "balance"],
  CLIENT_STATEMENT: (id: string) => ["clients", id, "statement"],
  STREETS: ["streets"],
  STREET: (id: string) => ["streets", id],
  ROUTES: ["routes"],
  ROUTE: (id: string) => ["routes", id],
  ROUTE_STREETS: (routeId: string) => ["routes", routeId, "streets"],
  ROUTE_STREET: (routeId: string, rsId: string) => [
    "routes",
    routeId,
    "streets",
    rsId,
  ],
  SALES: ["sales"],
  SALE: (id: string) => ["sales", id],
  SALE_INSTALLMENTS: (saleId: string) => ["sales", saleId, "installments"],
  PAYMENTS: ["payments"],
  USERS: ["users"],
  REPORTS_SALES: ["reports", "sales"],
  REPORTS_PAYMENTS: ["reports", "payments"],
  REPORTS_SUMMARY: ["reports", "summary"],
  ROUTE_TEMPLATES: ["route-templates"],
  ROUTE_TEMPLATE: (id: string) => ["route-templates", id],
  PRODUCTS: ["products"],
  PRODUCT: (id: string) => ["products", id],
} as const;

export const ROLES = {
  GERENTE: "GERENTE",
  VENDEDOR: "VENDEDOR",
} as const;

export const ROUTE_STATUS = {
  DRAFT: "DRAFT",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
} as const;

export const ROUTE_STREET_STATUS = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
} as const;
