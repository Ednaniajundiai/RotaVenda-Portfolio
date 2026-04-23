"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, Loader2, Pencil, Trash2, X, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  useRoute,
  useStartRoute,
  useCompleteRoute,
  useUpdateRoute,
  useDeleteRoute,
  useArchiveRoute,
  useRemoveRouteStreet,
  useSkipRouteStreet,
} from "@/hooks/useRoutes";
import { useAuth } from "@/providers/AuthProvider";
import { RouteStreetStatus } from "@/types/route";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

const RS_STATUS_LABEL: Record<RouteStreetStatus, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluída",
  SKIPPED: "Pulada",
};

const RS_STATUS_COLOR: Record<RouteStreetStatus, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-green-100 text-green-700",
  SKIPPED: "bg-yellow-100 text-yellow-700",
};

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

export default function RouteDetailPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const { data: route, isLoading } = useRoute(routeId);
  const startRoute = useStartRoute();
  const completeRoute = useCompleteRoute();
  const updateRoute = useUpdateRoute(routeId);
  const deleteRoute = useDeleteRoute();
  const archiveRoute = useArchiveRoute();
  const removeStreet = useRemoveRouteStreet(routeId);
  const skipStreet = useSkipRouteStreet(routeId);

  const isGerente = user?.role === "GERENTE";

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [dialog, setDialog] = useState<"delete" | "archive" | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="text-center py-12 text-gray-500">
        Rota não encontrada.{" "}
        <Link href="/rota" className="text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/rota"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Voltar
        </Link>
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-xl font-bold text-gray-900 border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Nome da rota"
                autoFocus
              />
              <input
                type="text"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full text-sm text-gray-500 border border-gray-300 rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações (opcional)"
              />
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {route.name}
              </h1>
              <p className="text-sm text-gray-500">
                {formatDate(route.route_date)} • {route.seller_name}
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  const trimmed = editName.trim();
                  if (!trimmed) return;
                  updateRoute.mutate(
                    { name: trimmed, notes: editNotes.trim() || undefined },
                    { onSuccess: () => setIsEditing(false) }
                  );
                }}
                disabled={updateRoute.isPending || !editName.trim()}
                className="p-2 rounded-full text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                title="Salvar"
              >
                {updateRoute.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="p-2 rounded-full text-gray-400 hover:bg-gray-100 transition-colors"
                title="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditName(route.name);
                  setEditNotes(route.notes ?? "");
                  setIsEditing(true);
                }}
                className="p-2 rounded-full text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                title="Editar rota"
              >
                <Pencil className="w-4 h-4" />
              </button>
              {route.status !== "IN_PROGRESS" && (
                <button
                  onClick={() => setDialog("archive")}
                  className="p-2 rounded-full text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                  title="Arquivar rota"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {isGerente && (
                <button
                  onClick={() => setDialog("delete")}
                  className="p-2 rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="Excluir rota"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-semibold text-gray-900 mt-0.5">
              {route.status === "DRAFT"
                ? "Rascunho"
                : route.status === "IN_PROGRESS"
                  ? "Em andamento"
                  : "Concluída"}
            </p>
          </div>
          <div className="flex gap-2">
            {route.status === "DRAFT" && (
              <button
                onClick={() => startRoute.mutate(routeId)}
                disabled={startRoute.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {startRoute.isPending ? "..." : "Iniciar Rota"}
              </button>
            )}
            {route.status === "IN_PROGRESS" && (
              <button
                onClick={() => completeRoute.mutate(routeId)}
                disabled={completeRoute.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {completeRoute.isPending ? "..." : "Concluir Rota"}
              </button>
            )}
          </div>
        </div>

        {!isEditing && route.notes && (
          <p className="mt-3 text-sm text-gray-500 italic">{route.notes}</p>
        )}
      </div>

      {/* Ruas */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-800">
          Ruas{" "}
          <span className="text-gray-400 font-normal">
            ({route.route_streets.length})
          </span>
        </h2>

        {route.route_streets.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400">
            <p>Nenhuma rua adicionada</p>
          </div>
        )}

        {route.route_streets.map((rs) => (
          <div
            key={rs.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 bg-gray-100 rounded-full text-xs text-gray-600 font-bold flex items-center justify-center shrink-0">
                      {rs.visit_order}
                    </span>
                    <p className="font-medium text-gray-900 truncate">
                      {rs.street_name}
                    </p>
                  </div>
                  {rs.street_neighborhood && (
                    <p className="text-xs text-gray-500 mt-0.5 ml-7">
                      {rs.street_neighborhood}
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    "shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
                    RS_STATUS_COLOR[rs.status]
                  )}
                >
                  {RS_STATUS_LABEL[rs.status]}
                </span>
              </div>

              <div className="flex gap-2 mt-3">
                {(rs.status === "PENDING" || rs.status === "IN_PROGRESS") && (
                  <Link
                    href={`/rota/${routeId}/rua/${rs.id}`}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium text-center hover:bg-blue-700 transition-colors"
                  >
                    {rs.status === "PENDING" ? "Atender" : "Continuar"}
                  </Link>
                )}
                {rs.status === "COMPLETED" && (
                  <Link
                    href={`/rota/${routeId}/rua/${rs.id}`}
                    className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium text-center hover:bg-gray-200 transition-colors"
                  >
                    Ver detalhes
                  </Link>
                )}
                {rs.status === "PENDING" && (
                  <button
                    onClick={() => skipStreet.mutate(rs.id)}
                    disabled={skipStreet.isPending}
                    className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium hover:bg-yellow-200 disabled:opacity-50 transition-colors"
                  >
                    Pular
                  </button>
                )}
                {isGerente && route.status === "DRAFT" && (
                  <button
                    onClick={() => removeStreet.mutate(rs.id)}
                    disabled={removeStreet.isPending}
                    className="px-3 py-2 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dialogs de confirmação */}
      <ConfirmDialog
        open={dialog === "archive"}
        title="Arquivar rota"
        description={`Deseja arquivar a rota "${route.name}"? Ela será movida para a lista de arquivadas.`}
        confirmLabel="Sim, arquivar"
        variant="warning"
        loading={archiveRoute.isPending}
        onConfirm={() =>
          archiveRoute.mutate(routeId, {
            onSuccess: () => {
              setDialog(null);
              router.push("/rota");
            },
          })
        }
        onCancel={() => setDialog(null)}
      />

      <ConfirmDialog
        open={dialog === "delete"}
        title="Excluir rota"
        description={`Deseja excluir permanentemente a rota "${route.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={deleteRoute.isPending}
        onConfirm={() =>
          deleteRoute.mutate(routeId, {
            onSuccess: () => {
              setDialog(null);
              router.push("/rota");
            },
          })
        }
        onCancel={() => setDialog(null)}
      />
    </div>
  );
}
