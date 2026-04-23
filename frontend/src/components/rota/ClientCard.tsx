"use client";

import { useState } from "react";

import { useSales } from "@/hooks/useSales";
import { cn } from "@/lib/utils";
import { PaymentCreate } from "@/types/payment";
import { ClientInRouteStreet } from "@/types/route";
import { SaleCreate } from "@/types/sale";

import { PaymentForm, PendingInstallment } from "./PaymentForm";
import { SaleForm } from "./SaleForm";

type ActiveForm = "sale" | "payment" | null;

interface ClientCardProps {
  client: ClientInRouteStreet;
  routeStreetId: string;
  onSale: (data: SaleCreate) => Promise<void>;
  onPayment: (data: PaymentCreate) => Promise<void>;
  isSaleLoading?: boolean;
  isPaymentLoading?: boolean;
}

export function ClientCard({
  client,
  routeStreetId,
  onSale,
  onPayment,
  isSaleLoading,
  isPaymentLoading,
}: ClientCardProps) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);

  const { data: clientSales } = useSales({ client_id: client.client_id });

  const pendingInstallments: PendingInstallment[] = (clientSales ?? [])
    .flatMap((s) =>
      s.installments
        .filter((i) => i.status !== "PAID")
        .map((i) => ({ ...i, sale_description: s.description }))
    )
    .sort(
      (a, b) =>
        new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );

  const balance = client.balance;
  const hasDebt = balance > 0.005;
  const hasCredit = balance < -0.005;

  const handleSale = async (data: SaleCreate) => {
    await onSale(data);
    setActiveForm(null);
  };

  const handlePayment = async (data: PaymentCreate) => {
    await onPayment(data);
    setActiveForm(null);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{client.name}</p>
            {(client.house_number || client.reference) && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {[client.house_number, client.reference]
                  .filter(Boolean)
                  .join(" — ")}
              </p>
            )}
            {client.phone && (
              <p className="text-xs text-gray-400">{client.phone}</p>
            )}
          </div>

          <div
            className={cn(
              "shrink-0 px-3 py-1.5 rounded-lg text-right",
              hasDebt
                ? "bg-red-50"
                : hasCredit
                  ? "bg-green-50"
                  : "bg-gray-50"
            )}
          >
            <p className="text-xs text-gray-500">Saldo</p>
            <p
              className={cn(
                "text-sm font-bold",
                hasDebt
                  ? "text-red-600"
                  : hasCredit
                    ? "text-green-600"
                    : "text-gray-400"
              )}
            >
              {hasCredit ? "CR " : ""}
              R${" "}
              {Math.abs(balance).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        {activeForm === null && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setActiveForm("sale")}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Venda
            </button>
            <button
              onClick={() => setActiveForm("payment")}
              className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 active:bg-green-800 transition-colors"
            >
              Pagamento
            </button>
          </div>
        )}
      </div>

      {activeForm === "sale" && (
        <div className="border-t border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-700 mb-3">
            Nova Venda — {client.name}
          </p>
          <SaleForm
            clientId={client.client_id}
            routeStreetId={routeStreetId}
            onSubmit={handleSale}
            onCancel={() => setActiveForm(null)}
            isLoading={isSaleLoading}
          />
        </div>
      )}

      {activeForm === "payment" && (
        <div className="border-t border-green-100 bg-green-50 p-4">
          <p className="text-xs font-semibold text-green-700 mb-3">
            Pagamento — {client.name}
          </p>
          <PaymentForm
            clientId={client.client_id}
            routeStreetId={routeStreetId}
            pendingInstallments={pendingInstallments}
            onSubmit={handlePayment}
            onCancel={() => setActiveForm(null)}
            isLoading={isPaymentLoading}
          />
        </div>
      )}
    </div>
  );
}
