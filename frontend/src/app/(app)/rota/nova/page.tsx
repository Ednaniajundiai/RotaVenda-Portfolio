"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { useStreets } from "@/hooks/useStreets";
import { useCreateRoute } from "@/hooks/useRoutes";
import { useRouteTemplates } from "@/hooks/useRouteTemplates";
import { useQueryClient } from "@tanstack/react-query";
import { RouteTemplate } from "@/types/routeTemplate";

const schema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  route_date: z.string().min(1, "Data obrigatória"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface SelectedStreet {
  street_id: string;
  street_name: string;
  street_neighborhood: string | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function NovaRotaPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const createRoute = useCreateRoute();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SelectedStreet[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: streets } = useStreets(search || undefined);
  const { data: templates } = useRouteTemplates();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", route_date: todayIso() },
  });

  const availableStreets = (streets ?? []).filter(
    (s) => !selected.some((sel) => sel.street_id === s.id)
  );

  function applyTemplate(template: RouteTemplate) {
    const toAdd = template.streets
      .filter((s) => !selected.some((sel) => sel.street_id === s.street_id))
      .map((s) => ({
        street_id: s.street_id,
        street_name: s.street_name,
        street_neighborhood: s.street_neighborhood,
      }));
    setSelected((prev) => [...prev, ...toAdd]);
    setShowTemplates(false);
  }

  function addStreet(street: {
    id: string;
    name: string;
    neighborhood: string | null;
  }) {
    setSelected((prev) => [
      ...prev,
      {
        street_id: street.id,
        street_name: street.name,
        street_neighborhood: street.neighborhood,
      },
    ]);
  }

  function removeStreet(index: number) {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setSelected((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setSelected((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const route = await createRoute.mutateAsync({
        name: values.name,
        route_date: values.route_date,
        notes: values.notes || undefined,
      });

      for (let i = 0; i < selected.length; i++) {
        await api.post(`/routes/${route.id}/streets`, {
          street_id: selected[i].street_id,
          visit_order: i + 1,
        });
      }

      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
      router.push(`/rota/${route.id}`);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Erro ao criar rota";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/rota"
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Voltar
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Nova Rota</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">Informações</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da rota
            </label>
            <input
              type="text"
              autoFocus
              placeholder="Ex: Centro - Manhã"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-red-500 text-xs mt-1">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da rota
            </label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register("route_date")}
            />
            {errors.route_date && (
              <p className="text-red-500 text-xs mt-1">
                {errors.route_date.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações (opcional)
            </label>
            <textarea
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Anotações sobre a rota..."
              {...register("notes")}
            />
          </div>
        </div>

        {/* Usar template */}
        {(templates ?? []).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Usar template</h2>
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                {showTemplates ? "Fechar" : "Escolher bairro"}
              </button>
            </div>

            {showTemplates && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {(templates ?? []).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {t.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t.streets.length} rua{t.streets.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span className="text-blue-500 text-sm font-medium shrink-0">
                      Usar
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!showTemplates && selected.length > 0 && (
              <p className="text-xs text-gray-400">
                {selected.length} rua{selected.length !== 1 ? "s" : ""}{" "}
                selecionada{selected.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {/* Seleção de ruas */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h2 className="font-semibold text-gray-800">
            Ruas{" "}
            {selected.length > 0 && (
              <span className="text-gray-400 font-normal">
                ({selected.length} selecionada{selected.length !== 1 ? "s" : ""})
              </span>
            )}
          </h2>

          {selected.length > 0 && (
            <div className="space-y-2">
              {selected.map((s, i) => (
                <div
                  key={s.street_id}
                  className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2"
                >
                  <span className="w-5 h-5 bg-blue-200 rounded-full text-xs text-blue-700 font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {s.street_name}
                    </p>
                    {s.street_neighborhood && (
                      <p className="text-xs text-gray-500">
                        {s.street_neighborhood}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 flex items-center justify-center"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(i)}
                      disabled={i === selected.length - 1}
                      className="w-6 h-6 rounded text-gray-400 hover:text-gray-600 disabled:opacity-20 flex items-center justify-center"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeStreet(i)}
                      className="w-6 h-6 rounded text-red-400 hover:text-red-600 flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Buscar rua para adicionar..."
            />
          </div>

          {availableStreets.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableStreets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => addStreet(s)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm text-gray-800">{s.name}</p>
                    {s.neighborhood && (
                      <p className="text-xs text-gray-500">{s.neighborhood}</p>
                    )}
                  </div>
                  <span className="text-blue-500 text-lg leading-none">+</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? "Criando rota..." : "Criar Rota"}
        </button>
      </form>
    </div>
  );
}
