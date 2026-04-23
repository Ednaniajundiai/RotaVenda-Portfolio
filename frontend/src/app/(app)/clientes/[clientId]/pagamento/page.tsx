"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "next/link";

import { useClient, useClientBalance } from "@/hooks/useClients";
import { useSales, useCreateSale } from "@/hooks/useSales";
import { useCreatePayment } from "@/hooks/usePayments";
import { PaymentForm } from "@/components/rota/PaymentForm";
import { SaleForm } from "@/components/rota/SaleForm";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PaymentCreate } from "@/types/payment";
import { SaleCreate } from "@/types/sale";

type ActiveTab = "venda" | "pagamento";

export default function ClientActionPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const [activeTab, setActiveTab] = useState<ActiveTab>("pagamento");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const { data: client, isLoading: loadingClient } = useClient(clientId);
  const { data: balance } = useClientBalance(clientId);
  const { data: clientSales } = useSales({ client_id: clientId });

  const createSale = useCreateSale();
  const createPayment = useCreatePayment();

  const pendingInstallments = useMemo(() => {
    if (!clientSales) return [];
    return (clientSales ?? [])
      .flatMap((s) =>
        s.installments
          .filter((i) => i.status !== "PAID")
          .map((i) => ({
            ...i,
            sale_description:
              s.description || `Venda ${formatDate(s.sale_date)}`,
          }))
      )
      .sort(
        (a, b) =>
          new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      );
  }, [clientSales]);

  async function handleSale(data: SaleCreate) {
    setErrorMsg("");
    try {
      await createSale.mutateAsync(data);
      setSuccessMsg("Venda registrada com sucesso!");
      setTimeout(() => router.push(`/clientes/${clientId}`), 2000);
    } catch {
      setErrorMsg("Erro ao registrar venda.");
    }
  }

  async function handlePayment(data: PaymentCreate) {
    setErrorMsg("");
    try {
      await createPayment.mutateAsync(data);
      setSuccessMsg("Pagamento registrado com sucesso!");
      setTimeout(() => router.push(`/clientes/${clientId}`), 2000);
    } catch {
      setErrorMsg("Erro ao registrar pagamento.");
    }
  }

  if (loadingClient || !client) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  const saldo = balance?.saldo ?? 0;

  const statusBadge = {
    PENDING: { label: "Pendente", className: "bg-orange-100 text-orange-700" },
    PARTIAL: { label: "Parcial", className: "bg-yellow-100 text-yellow-700" },
    OVERDUE: { label: "Vencida", className: "bg-red-100 text-red-700" },
    PAID: { label: "Paga", className: "bg-green-100 text-green-700" },
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/clientes" className="hover:text-gray-700">
          Clientes
        </Link>
        <span>/</span>
        <Link href={`/clientes/${clientId}`} className="hover:text-gray-700">
          {client.name}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Transação</span>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 font-medium">
          {errorMsg}
        </div>
      )}

      {/* ── Layout duas colunas no tablet ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:gap-5 md:items-start">

        {/* Coluna esquerda: info do cliente + parcelas pendentes */}
        <div className="md:w-2/5 space-y-4 shrink-0">
          {/* Card do cliente */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h1 className="text-xl font-bold text-gray-900">{client.name}</h1>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="text-sm text-blue-600 hover:underline mt-0.5 block"
              >
                {client.phone}
              </a>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Saldo atual</p>
              <p
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  saldo > 0
                    ? "text-red-600"
                    : saldo < 0
                    ? "text-green-600"
                    : "text-gray-400"
                )}
              >
                {formatCurrency(saldo)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {saldo > 0
                  ? "Cliente deve à loja"
                  : saldo < 0
                  ? "Crédito do cliente"
                  : "Sem débito"}
              </p>
            </div>
          </div>

          {/* Parcelas pendentes */}
          {pendingInstallments.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Parcelas pendentes ({pendingInstallments.length})
                </p>
              </div>
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {pendingInstallments.map((inst) => {
                  const badge =
                    statusBadge[inst.status as keyof typeof statusBadge] ??
                    statusBadge.PENDING;
                  return (
                    <div
                      key={inst.id}
                      className="px-4 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {inst.sale_description}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Vence {formatDate(inst.due_date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            badge.className
                          )}
                        >
                          {badge.label}
                        </span>
                        <p className="text-sm font-bold text-orange-600 tabular-nums mt-0.5">
                          {formatCurrency(inst.remaining)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: tabs + formulário */}
        <div className="md:flex-1 min-w-0 mt-4 md:mt-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Abas */}
            <div className="flex border-b border-gray-100">
              <button
                type="button"
                onClick={() => setActiveTab("pagamento")}
                className={cn(
                  "flex-1 py-3.5 text-sm font-semibold transition-colors",
                  activeTab === "pagamento"
                    ? "text-green-600 border-b-2 border-green-600 bg-green-50/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                Receber Pagamento
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("venda")}
                className={cn(
                  "flex-1 py-3.5 text-sm font-semibold transition-colors",
                  activeTab === "venda"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/40"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                )}
              >
                Registrar Venda
              </button>
            </div>

            <div className="p-4">
              {activeTab === "venda" ? (
                <SaleForm
                  clientId={clientId}
                  saleType="LOJA"
                  onSubmit={handleSale}
                  onCancel={() => router.push(`/clientes/${clientId}`)}
                  isLoading={createSale.isPending}
                />
              ) : (
                <PaymentForm
                  clientId={clientId}
                  pendingInstallments={pendingInstallments}
                  onSubmit={handlePayment}
                  onCancel={() => router.push(`/clientes/${clientId}`)}
                  isLoading={createPayment.isPending}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
