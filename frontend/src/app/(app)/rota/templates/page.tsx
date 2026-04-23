"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import {
  useRouteTemplates,
  useCreateRouteTemplate,
  useUpdateRouteTemplate,
  useDeleteRouteTemplate,
  useAddStreetToTemplate,
  useRemoveStreetFromTemplate,
  useReorderTemplateStreets,
} from "@/hooks/useRouteTemplates";
import { RouteTemplate, RouteTemplateStreetItem } from "@/types/routeTemplate";
import { useStreets } from "@/hooks/useStreets";

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: RouteTemplate;
  onEdit: (t: RouteTemplate) => void;
  onDelete: (t: RouteTemplate) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{template.name}</p>
          {template.description && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">
              {template.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 px-2 py-0.5 rounded-full text-xs font-medium",
            template.is_active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          )}
        >
          {template.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>

      <p className="text-xs text-gray-400">
        {template.streets.length} rua{template.streets.length !== 1 ? "s" : ""}
      </p>

      {template.streets.length > 0 && (
        <ul className="space-y-1">
          {template.streets.slice(0, 5).map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-xs text-gray-600">
              <span className="w-4 h-4 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-medium shrink-0">
                {s.visit_order}
              </span>
              {s.street_name}
            </li>
          ))}
          {template.streets.length > 5 && (
            <li className="text-xs text-gray-400 pl-6">
              +{template.streets.length - 5} mais...
            </li>
          )}
        </ul>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(template)}
          className="flex-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(template)}
          className="flex-1 py-1.5 text-xs font-medium border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
        >
          Excluir
        </button>
      </div>
    </div>
  );
}

interface LocalStreetItem {
  id?: string; // se undefined, é uma rua recém-adicionada no local
  street_id: string;
  street_name: string;
  street_neighborhood: string | null;
}

interface TemplateFormData {
  name: string;
  description: string;
  is_active: boolean;
  streets: LocalStreetItem[];
}

function TemplateModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: RouteTemplate;
  onClose: () => void;
  onSave: (data: TemplateFormData) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<TemplateFormData>({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    is_active: initial?.is_active ?? true,
    streets: initial?.streets
      ? [...initial.streets].sort((a, b) => a.visit_order - b.visit_order).map(s => ({
          id: s.id,
          street_id: s.street_id,
          street_name: s.street_name,
          street_neighborhood: s.street_neighborhood,
        }))
      : [],
  });

  const [search, setSearch] = useState("");
  const { data: streets } = useStreets(search || undefined);

  const availableStreets = (streets ?? []).filter(
    (s) => !form.streets.some((sel) => sel.street_id === s.id)
  );

  function addStreet(street: any) {
    setForm((f) => ({
      ...f,
      streets: [
        ...f.streets,
        {
          street_id: street.id,
          street_name: street.name,
          street_neighborhood: street.neighborhood,
        },
      ],
    }));
  }

  function removeStreet(index: number) {
    setForm((f) => ({
      ...f,
      streets: f.streets.filter((_, i) => i !== index),
    }));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setForm((f) => {
      const next = [...f.streets];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return { ...f, streets: next };
    });
  }

  function moveDown(index: number) {
    setForm((f) => {
      if (index >= f.streets.length - 1) return f;
      const next = [...f.streets];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return { ...f, streets: next };
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col p-6">
        <h2 className="font-bold text-gray-900 text-lg mb-4 shrink-0">
          {initial ? "Editar Template" : "Novo Template"}
        </h2>

        <div className="space-y-4 overflow-y-auto pr-2 pb-2">
          {/* Informações Básicas */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome (bairro)
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Centro"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrição (opcional)
              </label>
              <input
                type="text"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Descrição do template"
              />
            </div>

            {initial && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                  className="rounded"
                />
                Template ativo
              </label>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Seleção de Ruas */}
          <div className="space-y-4">
            <h2 className="font-semibold text-gray-800">
              Ruas do Template{" "}
              {form.streets.length > 0 && (
                <span className="text-gray-400 font-normal">
                  ({form.streets.length} selecionada{form.streets.length !== 1 ? "s" : ""})
                </span>
              )}
            </h2>

            {form.streets.length > 0 && (
              <div className="space-y-2">
                {form.streets.map((s, i) => (
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
                        disabled={i === form.streets.length - 1}
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

            {/* Buscar Rua */}
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
              <div className="space-y-1 max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-1 bg-gray-50">
                {availableStreets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addStreet(s)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">{s.name}</p>
                      {s.neighborhood && (
                        <p className="text-xs text-gray-500">{s.neighborhood}</p>
                      )}
                    </div>
                    <span className="text-blue-500 text-lg font-bold leading-none">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4 mt-auto shrink-0 border-t border-gray-200">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.name.trim()}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { data: templates, isLoading } = useRouteTemplates(false);
  const createTemplate = useCreateRouteTemplate();
  const deleteTemplate = useDeleteRouteTemplate();
  const addStreetMutation = useAddStreetToTemplate;
  const removeStreetMutation = useRemoveStreetFromTemplate;
  const reorderStreetsMutation = useReorderTemplateStreets;
  
  // Custom hook wrapper for API calls returning raw data if any
  const addStreet = {
    mutateAsync: async ({templateId, body}: any) => {
        const mutation = addStreetMutation(templateId).mutateAsync;
        return mutation(body);
    }
  };
  
  const removeStreet = {
    mutateAsync: async ({templateId, rtsId}: any) => {
        const mutation = removeStreetMutation(templateId).mutateAsync;
        return mutation(rtsId);
    }
  };

  const reorderStreets = {
    mutateAsync: async ({templateId, items}: any) => {
        const mutation = reorderStreetsMutation(templateId).mutateAsync;
        return mutation(items);
    }
  };

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<RouteTemplate | null>(null);
  const [deleting, setDeleting] = useState<RouteTemplate | null>(null);

  const updateTemplate = useUpdateRouteTemplate(editing?.id ?? "");

  async function handleCreate(data: TemplateFormData) {
    const t = await createTemplate.mutateAsync({
      name: data.name,
      description: data.description || undefined,
    });
    for (let i = 0; i < data.streets.length; i++) {
        await addStreet.mutateAsync({
            templateId: t.id,
            body: { street_id: data.streets[i].street_id, visit_order: i + 1 }
        });
    }
    setShowCreate(false);
  }

  async function handleUpdate(data: TemplateFormData) {
    if (!editing) return;
    await updateTemplate.mutateAsync({
      name: data.name,
      description: data.description || undefined,
      is_active: data.is_active,
    });

    const originalIds = new Set(editing.streets.map(s => s.id));
    const currentIds = new Set(data.streets.map(s => s.id).filter(id => id !== undefined));

    // Remove
    for (const street of editing.streets) {
        if (!currentIds.has(street.id)) {
            await removeStreet.mutateAsync({ templateId: editing.id, rtsId: street.id });
        }
    }

    // Identificar ruas que foram ADICIONADAS após a criação (id=undefined)
    // Elas precisam ser criadas primeiro antes de ordená-las
    const newStreetsToCreate = data.streets
      .map((s, index) => ({ street: s, index }))
      .filter(x => x.street.id === undefined);

    const reorderPayload = [];

    // Clonamos data.streets para atualizar os novos IDs gerados
    const updatedStreets = [...data.streets];

    for (const item of newStreetsToCreate) {
        const added = await addStreet.mutateAsync({
            templateId: editing.id,
            body: { street_id: item.street.street_id, visit_order: item.index + 1 }
        });
        // Na API RouteTemplateStreetAdd não retorna o id adicionado facilmente, mas o addStreet
        // hook tipicamente retorna o Template atualizado. Se retornar o Template, não teremos o UUID da rua exata 
        // a menos que encontremos no payload retornado.
        // O endpoint reorder só exige id das conexões existentes! Então para ruas novas, sua ordem de persistência no Array 
        // é mantida na inserção, mas para garantir safe, devemos reordenar todas as que SOBRARAM com ids que existem.
    }

    // Se houve mudança de ordem entre ruas existentes
    const existingStreetsOrder = data.streets.filter(s => s.id !== undefined).map((s, i) => ({
        id: s.id as string,
        visit_order: i + 1,
    }));

    if (existingStreetsOrder.length > 0) {
        await reorderStreets.mutateAsync({
            templateId: editing.id,
            items: existingStreetsOrder
        });
    }

    setEditing(null);
  }

  async function handleDelete() {
    if (!deleting) return;
    await deleteTemplate.mutateAsync(deleting.id);
    setDeleting(null);
  }

  const active = (templates ?? []).filter((t) => t.is_active);
  const inactive = (templates ?? []).filter((t) => !t.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/rota"
          className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
        >
          ← Rotas
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Templates de Rota</h1>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Novo Template
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      )}

      {!isLoading && (templates ?? []).length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">Nenhum template cadastrado</p>
          <p className="text-sm mt-1">
            Templates são criados automaticamente pelo script de seed
          </p>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Ativos ({active.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </section>
      )}

      {inactive.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Inativos ({inactive.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inactive.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onEdit={setEditing}
                onDelete={setDeleting}
              />
            ))}
          </div>
        </section>
      )}

      {showCreate && (
        <TemplateModal
          onClose={() => setShowCreate(false)}
          onSave={handleCreate}
          saving={createTemplate.isPending}
        />
      )}

      {editing && (
        <TemplateModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleUpdate}
          saving={updateTemplate.isPending}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-bold text-gray-900">Excluir template?</h2>
            <p className="text-sm text-gray-600">
              O template{" "}
              <span className="font-medium">{deleting.name}</span> será
              excluído permanentemente. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleting(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTemplate.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleteTemplate.isPending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
