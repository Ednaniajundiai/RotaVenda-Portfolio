"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";

import { useRoutes, useUnarchiveRoute, useDeleteRoute } from "@/hooks/useRoutes";
import { useAuth } from "@/providers/AuthProvider";
import { Route } from "@/types/route";
import { cn } from "@/lib/utils";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
};

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
};

function ArchivedRouteCard({ route, isGerente }: { route: Route; isGerente: boolean }) {
  const unarchiveMutation = useUnarchiveRoute();
  const deleteMutation = useDeleteRoute();
  const [dialog, setDialog] = useState<"unarchive" | "delete" | null>(null);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {route.name}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(route.route_date)} • {route.seller_name}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                STATUS_COLOR[route.status]
              )}
            >
              {STATUS_LABEL[route.status]}
            </span>
            <button
              onClick={() => setDialog("unarchive")}
              className="p-1.5 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Desarquivar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {isGerente && (
              <button
                onClick={() => setDialog("delete")}
                className="p-1.5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Excluir rota"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === "unarchive"}
        title="Desarquivar rota"
        description={`Deseja desarquivar a rota "${route.name}"? Ela voltará para a lista principal.`}
        confirmLabel="Sim, desarquivar"
        variant="default"
        loading={unarchiveMutation.isPending}
        onConfirm={() =>
          unarchiveMutation.mutate(route.id, { onSuccess: () => setDialog(null) })
        }
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title="Excluir rota"
        description={`Deseja excluir permanentemente a rota "${route.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() =>
          deleteMutation.mutate(route.id, { onSuccess: () => setDialog(null) })
        }
        onCancel={() => setDialog(null)}
      />
    </>
  );
}

export default function ArquivadasPage() {
  const { user } = useAuth();
  const { data: routes, isLoading } = useRoutes({ archived: true });
  const isGerente = user?.role === "GERENTE";

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link
          href="/rota"
          className="p-2 -ml-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Rotas Arquivadas</h1>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && (!routes || routes.length === 0) && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">Nenhuma rota arquivada</p>
        </div>
      )}

      {!isLoading && routes && routes.length > 0 && (
        <div className="grid gap-3">
          {routes.map((route) => (
            <ArchivedRouteCard key={route.id} route={route} isGerente={isGerente} />
          ))}
        </div>
      )}
    </div>
  );
}
