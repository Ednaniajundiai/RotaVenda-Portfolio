"use client";

import Link from "next/link";

import { useAuth } from "@/providers/AuthProvider";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useSales } from "@/hooks/useSales";
import { usePayments } from "@/hooks/usePayments";
import { useRoutes } from "@/hooks/useRoutes";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = todayIso();

  const { data: todaySales, isLoading: loadingSales } = useSales({
    sale_date: today,
  });
  const { data: todayPayments, isLoading: loadingPayments } = usePayments({
    payment_date: today,
  });
  const { data: todayRoutes, isLoading: loadingRoutes } = useRoutes({
    route_date: today,
  });

  const totalSales = (todaySales ?? []).reduce((sum, s) => sum + s.amount, 0);
  const fiadoSales = (todaySales ?? [])
    .filter((s) => s.payment_mode === "FIADO")
    .reduce((sum, s) => sum + s.amount, 0);
  const totalPayments = (todayPayments ?? []).reduce(
    (sum, p) => sum + p.amount,
    0
  );

  const myRoute =
    user?.role === "VENDEDOR"
      ? (todayRoutes ?? []).find((r) => r.seller_id === user.id)
      : (todayRoutes ?? [])[0];

  const routeStatusLabel: Record<string, string> = {
    DRAFT: "Rascunho",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluída",
  };

  const pendingStreets = (myRoute?.route_streets ?? []).filter(
    (rs) => rs.status === "PENDING" || rs.status === "IN_PROGRESS"
  ).length;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Olá, {user?.name?.split(" ")[0]}!
        </h2>
        <p className="text-sm text-gray-500 mt-1">{formatDate(new Date())}</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <SummaryCard
          label="Vendas do dia"
          value={loadingSales ? "..." : formatCurrency(totalSales)}
          description={
            loadingSales
              ? undefined
              : `${(todaySales ?? []).length} transaç${(todaySales ?? []).length === 1 ? "ão" : "ões"}` +
                (fiadoSales > 0 ? ` · ${formatCurrency(fiadoSales)} fiado` : "")
          }
          color="blue"
        />
        <SummaryCard
          label="Pagamentos recebidos"
          value={loadingPayments ? "..." : formatCurrency(totalPayments)}
          description={
            loadingPayments
              ? undefined
              : `${(todayPayments ?? []).length} pagament${(todayPayments ?? []).length === 1 ? "o" : "os"}`
          }
          color="green"
        />
        <SummaryCard
          label="Rota de hoje"
          value={
            loadingRoutes
              ? "..."
              : myRoute
                ? routeStatusLabel[myRoute.status] ?? myRoute.status
                : "Sem rota"
          }
          description={
            myRoute && pendingStreets > 0
              ? `${pendingStreets} rua${pendingStreets === 1 ? "" : "s"} pendente${pendingStreets === 1 ? "" : "s"}`
              : myRoute?.status === "COMPLETED"
                ? "Todas as ruas visitadas"
                : undefined
          }
          href={myRoute ? `/rota/${myRoute.id}` : "/rota/nova"}
          color="purple"
        />
      </div>

      {/* Acesso rápido */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Acesso rápido
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <QuickLink href="/rota/nova" label="Nova rota" color="blue" />
          <QuickLink href="/vendas" label="Vendas" color="green" />
          <QuickLink href="/clientes/novo" label="Novo cliente" color="purple" />
          {user?.role === "GERENTE" && (
            <>
              <QuickLink
                href="/produtos"
                label="Catálogo de Produtos"
                color="blue"
              />
              <QuickLink
                href="/gerente/relatorios"
                label="Relatórios"
                color="orange"
              />
            </>
          )}
        </div>
      </div>

      {/* Vendas recentes do dia */}
      {(todaySales ?? []).length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Últimas vendas hoje
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {(todaySales ?? [])
              .slice(0, 5)
              .map((sale) => (
                <div
                  key={sale.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {sale.client_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {sale.sale_type === "LOJA" ? "Loja" : "Rota"}
                      {sale.description ? ` · ${sale.description}` : ""}
                    </p>
                  </div>
                  <span
                    className={
                      sale.payment_mode === "FIADO"
                        ? "shrink-0 text-sm font-bold text-orange-600 ml-3"
                        : "shrink-0 text-sm font-bold text-blue-600 ml-3"
                    }
                  >
                    {formatCurrency(sale.amount)}
                    {sale.payment_mode === "FIADO" ? " F" : ""}
                  </span>
                </div>
              ))}
          </div>
          {(todaySales ?? []).length > 5 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              +{(todaySales ?? []).length - 5} mais
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: string;
  description?: string;
  href?: string;
  color?: "blue" | "green" | "purple";
}

function SummaryCard({ label, value, description, href, color = "blue" }: SummaryCardProps) {
  const borderColor = {
    blue: "border-blue-100",
    green: "border-green-100",
    purple: "border-purple-100",
  }[color];

  const content = (
    <div className={`bg-white rounded-xl border ${borderColor} p-5 h-full`}>
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {description && (
        <p className="text-xs text-gray-400 mt-1">{description}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block hover:opacity-80 transition-opacity">{content}</Link>;
  }
  return content;
}

function QuickLink({
  href,
  label,
  color,
}: {
  href: string;
  label: string;
  color: "blue" | "green" | "purple" | "orange";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-700 hover:bg-blue-100",
    green: "bg-green-50 text-green-700 hover:bg-green-100",
    purple: "bg-purple-50 text-purple-700 hover:bg-purple-100",
    orange: "bg-orange-50 text-orange-700 hover:bg-orange-100",
  };

  return (
    <Link
      href={href}
      className={`${colorMap[color]} rounded-xl p-4 text-sm font-medium text-center transition-colors block`}
    >
      {label}
    </Link>
  );
}
