"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useRoutes, useArchiveRoute, useDeleteRoute } from "@/hooks/useRoutes";
import { useAuth } from "@/providers/AuthProvider";
import { Route, RouteStatus } from "@/types/route";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const STATUS_LABEL: Record<RouteStatus, string> = {
  DRAFT: "Rascunho",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
};

const STATUS_COLOR: Record<RouteStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function RouteCard({ route, isGerente }: { route: Route; isGerente: boolean }) {
  const router = useRouter();
  const archiveMutation = useArchiveRoute();
  const deleteMutation = useDeleteRoute();
  const [dialog, setDialog] = useState<"archive" | "delete" | null>(null);

  const total = route.route_streets.length;
  const done = route.route_streets.filter(
    (rs) => rs.status === "COMPLETED" || rs.status === "SKIPPED"
  ).length;

  const canArchive = route.status !== "IN_PROGRESS";

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <Link
        href={`/rota/${route.id}`}
        className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {route.name}
            </p>
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(route.route_date)} • {route.seller_name}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium",
                STATUS_COLOR[route.status]
              )}
            >
              {STATUS_LABEL[route.status]}
            </span>
            <button
              onClick={(e) => { stop(e); router.push(`/rota/${route.id}`); }}
              className="p-1.5 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              title="Editar rota"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {canArchive && (
              <button
                onClick={(e) => { stop(e); setDialog("archive"); }}
                className="p-1.5 rounded-full text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                title="Arquivar rota"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            )}
            {isGerente && (
              <button
                onClick={(e) => { stop(e); setDialog("delete"); }}
                className="p-1.5 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                title="Excluir rota"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {total > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{total} ruas</span>
              <span>{done}/{total} concluídas</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${(done / total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {total === 0 && (
          <p className="mt-2 text-xs text-gray-400">Nenhuma rua adicionada</p>
        )}
      </Link>

      <ConfirmDialog
        open={dialog === "archive"}
        title="Arquivar rota"
        description={`Deseja arquivar a rota "${route.name}"? Ela será movida para a lista de arquivadas.`}
        confirmLabel="Sim, arquivar"
        variant="warning"
        loading={archiveMutation.isPending}
        onConfirm={() =>
          archiveMutation.mutate(route.id, { onSuccess: () => setDialog(null) })
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

export default function RotaPage() {
  const { user } = useAuth();
  const { data: routes, isLoading } = useRoutes();
  const isGerente = user?.role === "GERENTE";

  const grouped = {
    IN_PROGRESS: (routes ?? []).filter((r) => r.status === "IN_PROGRESS"),
    DRAFT: (routes ?? []).filter((r) => r.status === "DRAFT"),
    COMPLETED: (routes ?? []).filter((r) => r.status === "COMPLETED"),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900">Minhas Rotas</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/rota/arquivadas"
            className="w-full sm:w-auto text-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Arquivadas
          </Link>
          <Link
            href="/rota/templates"
            className="w-full sm:w-auto text-center px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Templates
          </Link>
          <Link
            href="/rota/nova"
            className="w-full sm:w-auto text-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Nova Rota
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && (routes ?? []).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">Nenhuma rota encontrada</p>
          <p className="text-sm mt-1">Crie sua primeira rota para começar</p>
        </div>
      )}

      {grouped.IN_PROGRESS.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Em andamento
          </h2>
          <div className="space-y-3">
            {grouped.IN_PROGRESS.map((r) => (
              <RouteCard key={r.id} route={r} isGerente={isGerente} />
            ))}
          </div>
        </section>
      )}

      {grouped.DRAFT.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Rascunhos
          </h2>
          <div className="space-y-3">
            {grouped.DRAFT.map((r) => (
              <RouteCard key={r.id} route={r} isGerente={isGerente} />
            ))}
          </div>
        </section>
      )}

      {grouped.COMPLETED.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Concluídas
          </h2>
          <div className="space-y-3">
            {grouped.COMPLETED.map((r) => (
              <RouteCard key={r.id} route={r} isGerente={isGerente} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
