"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Edit2, Loader2, Trash2 } from "lucide-react";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { useSales, useDeleteSale } from "@/hooks/useSales";
import { usePayments } from "@/hooks/usePayments";
import { Sale } from "@/types/sale";
import { Payment } from "@/types/payment";

type PeriodFilter = "hoje" | "semana" | "mes" | "tudo";
type TipoFilter = "todos" | "LOJA" | "ROTA";
type ModoFilter = "todos" | "A_VISTA" | "FIADO";

function startOfPeriod(period: PeriodFilter): string | null {
  const d = new Date();
  if (period === "hoje") {
    return d.toISOString().slice(0, 10);
  }
  if (period === "semana") {
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }
  if (period === "mes") {
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

type SaleRow = Sale & { _kind: "sale" };
type PaymentRow = Payment & { _kind: "payment" };
type Row = SaleRow | PaymentRow;

export default function VendasPage() {
  const [period, setPeriod] = useState<PeriodFilter>("hoje");
  const [tipo, setTipo] = useState<TipoFilter>("todos");
  const [modo, setModo] = useState<ModoFilter>("todos");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const deleteSale = useDeleteSale();

  const { data: allSales, isLoading: loadingSales } = useSales();
  const { data: allPayments, isLoading: loadingPayments } = usePayments();

  const cutoff = startOfPeriod(period);

  const filteredSales = useMemo<Sale[]>(() => {
    let items = allSales ?? [];
    if (cutoff) items = items.filter((s) => s.sale_date >= cutoff);
    if (tipo !== "todos") items = items.filter((s) => s.sale_type === tipo);
    if (modo !== "todos") items = items.filter((s) => s.payment_mode === modo);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((s) => s.client_name.toLowerCase().includes(q));
    }
    return items;
  }, [allSales, cutoff, tipo, modo, search]);

  const filteredPayments = useMemo<Payment[]>(() => {
    if (tipo !== "todos") return [];
    let items = allPayments ?? [];
    if (cutoff) items = items.filter((p) => p.payment_date >= cutoff);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((p) => p.client_name.toLowerCase().includes(q));
    }
    return items;
  }, [allPayments, cutoff, tipo, search]);

  const rows = useMemo<Row[]>(() => {
    const saleRows: SaleRow[] = filteredSales.map((s) => ({ ...s, _kind: "sale" as const }));
    const payRows: PaymentRow[] = filteredPayments.map((p) => ({ ...p, _kind: "payment" as const }));
    return [...saleRows, ...payRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [filteredSales, filteredPayments]);

  const totalVendas = filteredSales.reduce((s, v) => s + v.amount, 0);
  const totalFiado = filteredSales
    .filter((v) => v.payment_mode === "FIADO")
    .reduce((s, v) => s + v.amount, 0);
  const totalPagamentos = filteredPayments.reduce((s, p) => s + p.amount, 0);

  const isLoading = loadingSales || loadingPayments;

  const PERIOD_LABELS: Record<PeriodFilter, string> = {
    hoje: "Hoje",
    semana: "7 dias",
    mes: "30 dias",
    tudo: "Tudo",
  };

  const TIPO_LABELS: Record<TipoFilter, string> = {
    todos: "Todos",
    LOJA: "Loja",
    ROTA: "Rota",
  };

  return (
    <div className="max-w-3xl mx-auto pb-28 md:pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Vendas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(new Date())}</p>
        </div>
        <Link
          href="/vendas/nova"
          className="bg-blue-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          + Nova venda
        </Link>
      </div>

      {/* Cards de totais */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border border-blue-100 p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Vendas</p>
          <p className="text-base sm:text-lg font-bold text-blue-700 tabular-nums">
            {isLoading ? "..." : formatCurrency(totalVendas)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredSales.length} itens
          </p>
        </div>
        <div className="bg-white rounded-xl border border-orange-100 p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Fiado</p>
          <p className="text-base sm:text-lg font-bold text-orange-600 tabular-nums">
            {isLoading ? "..." : formatCurrency(totalFiado)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredSales.filter((s) => s.payment_mode === "FIADO").length} itens
          </p>
        </div>
        <div className="bg-white rounded-xl border border-green-100 p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Pagamentos</p>
          <p className="text-base sm:text-lg font-bold text-green-700 tabular-nums">
            {isLoading ? "..." : formatCurrency(totalPagamentos)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filteredPayments.length} itens
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 space-y-3">
        {/* Busca */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Período */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                period === p
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Tipo + Modo */}
        <div className="flex gap-3">
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(TIPO_LABELS) as TipoFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  tipo === t
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {TIPO_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 flex-wrap">
            {(["todos", "A_VISTA", "FIADO"] as ModoFilter[]).map((m) => (
              <button
                key={m}
                onClick={() => setModo(m)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors",
                  modo === m
                    ? "bg-gray-800 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
              >
                {m === "todos" ? "Qualquer" : m === "A_VISTA" ? "À vista" : "Fiado"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Carregando...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400">
          Nenhuma movimentação encontrada
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {rows.map((row) => {
            if (row._kind === "sale") {
              const sale = row as SaleRow;
              const isConfirming = deletingId === sale.id;
              return (
                <div
                  key={"sale-" + sale.id}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  {isConfirming ? (
                    <div className="flex flex-1 items-center justify-between gap-2">
                      <span className="text-sm text-red-600 font-medium">
                        Excluir esta venda?
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => setDeletingId(null)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={async () => {
                            await deleteSale.mutateAsync(sale.id);
                            setDeletingId(null);
                          }}
                          disabled={deleteSale.isPending}
                          className="text-xs text-white bg-red-600 hover:bg-red-700 font-medium px-2 py-1 rounded flex items-center gap-1 disabled:opacity-50"
                        >
                          {deleteSale.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trash2 className="w-3 h-3" />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Link
                        href={`/vendas/${sale.id}`}
                        className="min-w-0 flex-1"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded",
                              sale.payment_mode === "FIADO"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {sale.payment_mode === "FIADO" ? "Fiado" : "À vista"}
                          </span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">
                            {sale.sale_type === "LOJA" ? "Loja" : "Rota"}
                          </span>
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {sale.client_name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatDate(sale.sale_date)}
                          {sale.seller_name ? ` · ${sale.seller_name}` : ""}
                          {sale.description ? ` · ${sale.description}` : ""}
                        </p>
                      </Link>
                      <div className="shrink-0 flex items-center gap-2 ml-3">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            sale.payment_mode === "FIADO"
                              ? "text-orange-600"
                              : "text-blue-600"
                          )}
                        >
                          {formatCurrency(sale.amount)}
                        </span>
                        <Link
                          href={`/vendas/${sale.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar venda"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeletingId(sale.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir venda"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            }

            const payment = row as PaymentRow;
            return (
              <Link
                key={"payment-" + payment.id}
                href={`/clientes/${payment.client_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      Pagamento
                    </span>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {payment.client_name}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(payment.payment_date)}
                    {payment.seller_name ? ` · ${payment.seller_name}` : ""}
                    {payment.notes ? ` · ${payment.notes}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold ml-3 text-green-600 tabular-nums">
                  +{formatCurrency(payment.amount)}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
