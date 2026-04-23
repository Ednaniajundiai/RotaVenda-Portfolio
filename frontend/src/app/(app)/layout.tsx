"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { BottomNav } from "@/components/shared/BottomNav";

const navItems = [
  { href: "/dashboard", label: "Dashboard", roles: ["GERENTE", "VENDEDOR"] },
  { href: "/rota", label: "Rota", roles: ["GERENTE", "VENDEDOR"] },
  { href: "/vendas", label: "Vendas", roles: ["GERENTE", "VENDEDOR"] },
  { href: "/clientes", label: "Clientes", roles: ["GERENTE", "VENDEDOR"] },
  { href: "/produtos", label: "Produtos", roles: ["GERENTE"] },
  { href: "/ruas", label: "Ruas", roles: ["GERENTE", "VENDEDOR"] },
  { href: "/gerente/usuarios", label: "Usuários", roles: ["GERENTE"] },
  { href: "/gerente/relatorios", label: "Relatórios", roles: ["GERENTE"] },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const visibleNav = navItems.filter((item) =>
    (item.roles as ReadonlyArray<string>).includes(user!.role)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">RV</span>
            </div>
            <span className="font-semibold text-gray-900 hidden sm:block">
              RotaVenda
            </span>
          </div>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Usuário */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500">
                {user?.role === "GERENTE" ? "Gerente" : "Vendedor"}
              </p>
            </div>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 transition-colors px-2 py-1 rounded"
            >
              Sair
            </button>
          </div>
        </div>

      </header>

      {/* Conteúdo */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      <BottomNav />
      <Toaster richColors position="top-center" />
    </div>
  );
}
