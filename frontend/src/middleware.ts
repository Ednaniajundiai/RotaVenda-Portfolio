import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Middleware de proteção das rotas /gerente.
 *
 * Estratégia: o AuthProvider armazena o objeto do usuário em localStorage
 * sob a chave "rotavenda_user". O middleware não tem acesso ao localStorage,
 * mas o AuthProvider também persiste o role em um cookie "rotavenda_role"
 * (ver AuthProvider.tsx) para que o middleware possa verificá-lo aqui,
 * antes de qualquer renderização.
 *
 * Se o cookie não existir ou o role não for "GERENTE", redireciona para
 * /dashboard imediatamente — sem flicker de conteúdo.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Só protege as rotas do gerente
  if (!pathname.startsWith("/gerente")) {
    return NextResponse.next();
  }

  const role = request.cookies.get("rotavenda_role")?.value;

  if (role !== "GERENTE") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/gerente/:path*"],
};
