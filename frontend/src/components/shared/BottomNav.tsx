"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Package,
  ShoppingCart,
  Users,
  MoreHorizontal,
} from "lucide-react";

import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Início",
    icon: <LayoutDashboard className="w-5 h-5" />,
    roles: ["GERENTE", "VENDEDOR"],
  },
  {
    href: "/rota",
    label: "Rota",
    icon: <MapPin className="w-5 h-5" />,
    roles: ["GERENTE", "VENDEDOR"],
  },
  {
    href: "/vendas",
    label: "Vendas",
    icon: <ShoppingCart className="w-5 h-5" />,
    roles: ["GERENTE", "VENDEDOR"],
  },
  {
    href: "/clientes",
    label: "Clientes",
    icon: <Users className="w-5 h-5" />,
    roles: ["GERENTE", "VENDEDOR"],
  },
  {
    href: "/produtos",
    label: "Produtos",
    icon: <Package className="w-5 h-5" />,
    roles: ["GERENTE"],
  },
  {
    href: "/gerente/relatorios",
    label: "Mais",
    icon: <MoreHorizontal className="w-5 h-5" />,
    roles: ["GERENTE"],
  },
];

export function BottomNav() {
  const { user } = useAuth();
  const pathname = usePathname();

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user?.role ?? "")
  );

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-20"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-10 h-7 rounded-full transition-colors",
                  isActive ? "bg-blue-50" : ""
                )}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
