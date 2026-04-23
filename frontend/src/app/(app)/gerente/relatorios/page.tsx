"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/AuthProvider";
import {
  usePaymentsReport,
  useSalesReport,
  useSummaryReport,
  type PaymentReportItem,
  type ReportFilters,
  type SaleReportItem,
} from "@/hooks/useReports";

type Tab = "vendas" | "pagamentos";

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function exportToCsv(filename: string, rows: string[][]): void {
  const bom = "\uFEFF";
  const csv =
    bom + rows.map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
}

export default function RelatoriosPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && user.role !== "GERENTE") router.replace("/dashboard");
  }, [user, router]);

  const [tab, setTab] = useState<Tab>("vendas");
  const [filters, setFilters] = useState<ReportFilters>({
    date_from: firstOfMonth(),
    date_to: today(),
  });

  const salesReport = useSalesReport(filters);
  const paymentsReport = usePaymentsReport({
    date_from: filters.date_from,
    date_to: filters.date_to,
    seller_id: filters.seller_id,
  });
  const summary = useSummaryReport({
    date_from: filters.date_from,
    date_to: filters.date_to,
  });

  if (!user || user.role !== "GERENTE") return null;

  function handleExportSales() {
    if (!salesReport.data) return;
    const header = [
      "Data",
      "Cliente",
      "Vendedor",
      "Canal",
      "Pagamento",
      "Valor",
      "Descrição",
    ];
    const rows = salesReport.data.items.map((s: SaleReportItem) => [
      formatDate(s.sale_date),
      s.client_name,
      s.seller_name,
      s.sale_type === "ROTA" ? "Rota" : "Loja",
      s.payment_mode === "A_VISTA" ? "À Vista" : "Fiado",
      s.amount.toFixed(2).replace(".", ","),
      s.description ?? "",
    ]);
    exportToCsv(
      `vendas_${filters.date_from ?? "tudo"}_${filters.date_to ?? "tudo"}.csv`,
      [header, ...rows]
    );
  }

  function handleExportPayments() {
    if (!paymentsReport.data) return;
    const header = ["Data", "Cliente", "Recebido por", "Valor", "Observações"];
    const rows = paymentsReport.data.items.map((p: PaymentReportItem) => [
      formatDate(p.payment_date),
      p.client_name,
      p.seller_name,
      p.amount.toFixed(2).replace(".", ","),
      p.notes ?? "",
    ]);
    exportToCsv(
      `pagamentos_${filters.date_from ?? "tudo"}_${filters.date_to ?? "tudo"}.csv`,
      [header, ...rows]
    );
  }

  const currentReportLoading =
    tab === "vendas" ? salesReport.isLoading : paymentsReport.isLoading;

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Análise de vendas e pagamentos da loja
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              De
            </label>
            <input
              type="date"
              value={filters.date_from ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  date_from: e.target.value || undefined,
                }))
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Até
            </label>
            <input
              type="date"
              value={filters.date_to ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  date_to: e.target.value || undefined,
                }))
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Canal
            </label>
            <select
              value={filters.sale_type ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  sale_type: e.target.value || undefined,
                }))
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="ROTA">Rota</option>
              <option value="LOJA">Loja</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Pagamento
            </label>
            <select
              value={filters.payment_mode ?? ""}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  payment_mode: e.target.value || undefined,
                }))
              }
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="A_VISTA">À Vista</option>
              <option value="FIADO">Fiado</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <SummaryCard
          label="Total Vendido"
          value={summary.data ? formatBRL(summary.data.total_sales) : "—"}
          sub={
            summary.data
              ? `${summary.data.total_sales_count} venda(s)`
              : undefined
          }
          loading={summary.isLoading}
        />
        <SummaryCard
          label="À Vista"
          value={summary.data ? formatBRL(summary.data.total_a_vista) : "—"}
          color="text-green-700"
          loading={summary.isLoading}
        />
        <SummaryCard
          label="Fiado (período)"
          value={summary.data ? formatBRL(summary.data.total_fiado) : "—"}
          color="text-orange-600"
          loading={summary.isLoading}
        />
        <SummaryCard
          label="Saldo Devedor Total"
          value={
            summary.data ? formatBRL(summary.data.saldo_devedor_total) : "—"
          }
          color={
            summary.data && summary.data.saldo_devedor_total > 0
              ? "text-red-600"
              : "text-green-700"
          }
          sub="todos os tempos"
          loading={summary.isLoading}
        />
      </div>

      {/* Top clientes com fiado */}
      {summary.data &&
        summary.data.top_clients.length > 0 &&
        !filters.sale_type &&
        !filters.payment_mode && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">
              Top clientes em fiado no período
            </h2>
            <div className="space-y-2">
              {summary.data.top_clients.map((c, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400 w-4">
                      {i + 1}.
                    </span>
                    <span className="text-sm text-gray-800">{c.client_name}</span>
                  </div>
                  <span className="text-sm font-semibold text-orange-600">
                    {formatBRL(c.total_fiado)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Abas + tabela */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-4">
          <div className="flex">
            {(["vendas", "pagamentos"] as Tab[]).map((t) => {
              const count =
                t === "vendas"
                  ? salesReport.data?.total_count
                  : paymentsReport.data?.total_count;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "vendas" ? "Vendas" : "Pagamentos"}
                  {count !== undefined && (
                    <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            onClick={
              tab === "vendas" ? handleExportSales : handleExportPayments
            }
            disabled={currentReportLoading}
            className="text-xs text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 font-medium disabled:opacity-50 transition-colors"
          >
            Exportar CSV
          </button>
        </div>

        {currentReportLoading ? (
          <div className="py-16 text-center text-sm text-gray-400">
            Carregando...
          </div>
        ) : tab === "vendas" ? (
          <SalesTable items={salesReport.data?.items ?? []} />
        ) : (
          <PaymentsTable items={paymentsReport.data?.items ?? []} />
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color = "text-gray-900",
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 bg-gray-100 rounded animate-pulse w-24" />
      ) : (
        <p className={`text-xl font-bold ${color}`}>{value}</p>
      )}
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SalesTable({ items }: { items: SaleReportItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        Nenhuma venda encontrada para os filtros selecionados
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Data
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Cliente
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
              Vendedor
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
              Canal
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Pagamento
            </th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">
              Valor
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {formatDate(s.sale_date)}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {s.client_name}
                {s.description && (
                  <p className="text-xs text-gray-400 font-normal truncate max-w-xs">
                    {s.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                {s.seller_name}
              </td>
              <td className="px-4 py-3 hidden md:table-cell">
                <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  {s.sale_type === "ROTA" ? "Rota" : "Loja"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    s.payment_mode === "FIADO"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {s.payment_mode === "FIADO" ? "Fiado" : "À Vista"}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                {formatBRL(s.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentsTable({ items }: { items: PaymentReportItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-gray-400">
        Nenhum pagamento encontrado para os filtros selecionados
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Data
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600">
              Cliente
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
              Recebido por
            </th>
            <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
              Observações
            </th>
            <th className="text-right px-4 py-3 font-medium text-gray-600">
              Valor
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {items.map((p) => (
            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                {formatDate(p.payment_date)}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">
                {p.client_name}
              </td>
              <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                {p.seller_name}
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                {p.notes ?? "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">
                {formatBRL(p.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
