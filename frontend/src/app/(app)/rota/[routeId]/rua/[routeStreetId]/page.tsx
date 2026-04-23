"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  useRouteStreetDetail,
  useStartRouteStreet,
  useCompleteRouteStreet,
  useSkipRouteStreet,
} from "@/hooks/useRoutes";
import { useCreateSale } from "@/hooks/useSales";
import { useCreatePayment } from "@/hooks/usePayments";
import { useSales } from "@/hooks/useSales";
import { usePayments } from "@/hooks/usePayments";
import { ClientCard } from "@/components/rota/ClientCard";
import { RouteStreetStatus } from "@/types/route";
import { SaleCreate } from "@/types/sale";
import { PaymentCreate } from "@/types/payment";

const STATUS_LABEL: Record<RouteStreetStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  SKIPPED: "Pulada",
};

const STATUS_COLOR: Record<RouteStreetStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

export default function RouteStreetPage() {
  const { routeId, routeStreetId } = useParams<{
    routeId: string;
    routeStreetId: string;
  }>();

  const { data: detail, isLoading } = useRouteStreetDetail(
    routeId,
    routeStreetId
  );
  const { data: visitSales } = useSales({
    route_street_id: routeStreetId,
  });
  const { data: visitPayments } = usePayments({
    route_street_id: routeStreetId,
  });

  const startStreet = useStartRouteStreet(routeId);
  const completeStreet = useCompleteRouteStreet(routeId);
  const skipStreet = useSkipRouteStreet(routeId);
  const createSale = useCreateSale();
  const createPayment = useCreatePayment();

  const handleSale = async (data: SaleCreate) => {
    await createSale.mutateAsync(data);
  };

  const handlePayment = async (data: PaymentCreate) => {
    await createPayment.mutateAsync(data);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-12 text-gray-500">
        Rua não encontrada.{" "}
        <Link href={`/rota/${routeId}`} className="text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const totalVisitSales = (visitSales ?? []).reduce(
    (sum, s) => sum + s.amount,
    0
  );
  const totalVisitPayments = (visitPayments ?? []).reduce(
    (sum, p) => sum + p.amount,
    0
  );

  return (
    <div className="max-w-lg mx-auto space-y-4 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link
          href={`/rota/${routeId}`}
          className="mt-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          ←
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">
            {detail.street_name}
          </h1>
          {detail.street_neighborhood && (
            <p className="text-sm text-gray-500">{detail.street_neighborhood}</p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 mt-1 px-2.5 py-1 rounded-full text-xs font-medium",
            STATUS_COLOR[detail.status as RouteStreetStatus]
          )}
        >
          {STATUS_LABEL[detail.status as RouteStreetStatus]}
        </span>
      </div>

      {/* Ações da rua */}
      {detail.status !== "COMPLETED" && detail.status !== "SKIPPED" && (
        <div className="flex gap-2">
          {detail.status === "PENDING" && (
            <button
              onClick={() => startStreet.mutate(routeStreetId)}
              disabled={startStreet.isPending}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {startStreet.isPending ? "..." : "Iniciar Atendimento"}
            </button>
          )}
          {detail.status === "IN_PROGRESS" && (
            <button
              onClick={() => completeStreet.mutate(routeStreetId)}
              disabled={completeStreet.isPending}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {completeStreet.isPending ? "..." : "Concluir Rua"}
            </button>
          )}
          {(detail.status === "PENDING" || detail.status === "IN_PROGRESS") && (
            <button
              onClick={() => skipStreet.mutate(routeStreetId)}
              disabled={skipStreet.isPending}
              className="px-4 py-2.5 bg-yellow-100 text-yellow-700 rounded-xl text-sm font-medium hover:bg-yellow-200 disabled:opacity-50 transition-colors"
            >
              Pular
            </button>
          )}
        </div>
      )}

      {/* Resumo da visita */}
      {((visitSales ?? []).length > 0 || (visitPayments ?? []).length > 0) && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Nesta visita
          </p>
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-500">Vendas</p>
              <p className="text-sm font-bold text-blue-700">
                {(visitSales ?? []).length} —{" "}
                R${" "}
                {totalVisitSales.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Recebimentos</p>
              <p className="text-sm font-bold text-green-700">
                {(visitPayments ?? []).length} —{" "}
                R${" "}
                {totalVisitPayments.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Transações individuais */}
          {(visitSales ?? []).length > 0 && (
            <div className="mt-3 space-y-1">
              {(visitSales ?? []).map((s) => (
                <div
                  key={s.id}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span>
                    {s.client_name}
                    {s.description ? ` — ${s.description}` : ""}
                  </span>
                  <span
                    className={
                      s.payment_mode === "FIADO"
                        ? "text-orange-600 font-medium"
                        : "text-green-600 font-medium"
                    }
                  >
                    R${" "}
                    {s.amount.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {s.payment_mode === "FIADO" ? "(F)" : "(V)"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {(visitPayments ?? []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(visitPayments ?? []).map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between text-xs text-gray-600"
                >
                  <span className="text-green-700">
                    ↩ {p.client_name}
                    {p.notes ? ` — ${p.notes}` : ""}
                  </span>
                  <span className="text-green-600 font-medium">
                    R${" "}
                    {p.amount.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clientes */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800">
          Clientes{" "}
          <span className="text-gray-400 font-normal">
            ({detail.clients.length})
          </span>
        </h2>

        {detail.clients.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
            <p>Nenhum cliente cadastrado nesta rua</p>
          </div>
        )}

        {detail.clients.map((client) => (
          <ClientCard
            key={client.client_id}
            client={client}
            routeStreetId={routeStreetId}
            onSale={handleSale}
            onPayment={handlePayment}
            isSaleLoading={createSale.isPending}
            isPaymentLoading={createPayment.isPending}
          />
        ))}
      </div>
    </div>
  );
}
