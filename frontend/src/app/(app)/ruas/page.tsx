"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useCreateStreet, useStreets } from "@/hooks/useStreets";
import { formatDate } from "@/lib/utils";

export default function RuasPage() {
  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { data: streets, isLoading } = useStreets(search || undefined);
  const createStreet = useCreateStreet();

  const [form, setForm] = useState({ name: "", neighborhood: "", cep: "" });
  const [formError, setFormError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório");
      return;
    }
    try {
      await createStreet.mutateAsync({
        name: form.name.trim(),
        neighborhood: form.neighborhood.trim() || undefined,
        cep: form.cep.trim() || undefined,
      });
      setForm({ name: "", neighborhood: "", cep: "" });
      setFormError("");
      setShowForm(false);
    } catch {
      setFormError("Erro ao cadastrar rua");
    }
  }

  // Agrupar por bairro
  const byNeighborhood = (streets ?? []).reduce<Record<string, typeof streets>>(
    (acc, s) => {
      const key = s!.neighborhood ?? "Sem bairro";
      if (!acc[key]) acc[key] = [];
      acc[key]!.push(s!);
      return acc;
    },
    {}
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ruas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {streets?.length ?? 0} rua(s) cadastrada(s)
          </p>
        </div>
        {isGerente && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {showForm ? "Cancelar" : "+ Nova rua"}
          </button>
        )}
      </div>

      {/* Formulário de criação */}
      {showForm && isGerente && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Nova rua
          </h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: e.target.value })}
                  placeholder="00000-000"
                  maxLength={9}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome da rua <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex.: Rua das Flores"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bairro
                </label>
                <input
                  type="text"
                  value={form.neighborhood}
                  onChange={(e) =>
                    setForm({ ...form, neighborhood: e.target.value })
                  }
                  placeholder="Ex.: Jardim Novo Horizonte"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={createStreet.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createStreet.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, bairro ou CEP..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Carregando...
        </div>
      ) : Object.keys(byNeighborhood).length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Nenhuma rua encontrada
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byNeighborhood)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([neighborhood, items]) => (
              <div key={neighborhood}>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {neighborhood}
                </h2>
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {items!.map((street) => (
                    <Link
                      key={street!.id}
                      href={`/ruas/${street!.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {street!.name}
                        </p>
                        {street!.cep && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            CEP {street!.cep}
                          </p>
                        )}
                      </div>
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
