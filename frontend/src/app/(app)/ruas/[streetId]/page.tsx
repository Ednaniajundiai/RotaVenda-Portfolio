"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import {
  useDeactivateStreet,
  useStreet,
  useStreetClients,
  useUpdateStreet,
} from "@/hooks/useStreets";

export default function StreetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const streetId = params.streetId as string;

  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const { data: street, isLoading } = useStreet(streetId);
  const { data: clients } = useStreetClients(streetId);
  const updateStreet = useUpdateStreet(streetId);
  const deactivateStreet = useDeactivateStreet();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", neighborhood: "", cep: "" });
  const [formError, setFormError] = useState("");

  function startEdit() {
    if (!street) return;
    setForm({
      name: street.name,
      neighborhood: street.neighborhood ?? "",
      cep: street.cep ?? "",
    });
    setEditing(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório");
      return;
    }
    try {
      await updateStreet.mutateAsync({
        name: form.name.trim(),
        neighborhood: form.neighborhood.trim() || undefined,
        cep: form.cep.trim() || undefined,
      });
      setEditing(false);
      setFormError("");
    } catch {
      setFormError("Erro ao atualizar rua");
    }
  }

  async function handleDeactivate() {
    if (!confirm("Desativar esta rua? Ela não aparecerá mais nas buscas."))
      return;
    await deactivateStreet.mutateAsync(streetId);
    router.push("/ruas");
  }

  if (isLoading) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (!street) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        Rua não encontrada.{" "}
        <Link href="/ruas" className="text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/ruas" className="hover:text-gray-700">
          Ruas
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{street.name}</span>
      </div>

      {/* Cabeçalho */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Editar rua
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CEP
                </label>
                <input
                  type="text"
                  value={form.cep}
                  onChange={(e) => setForm({ ...form, cep: e.target.value })}
                  maxLength={9}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateStreet.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {updateStreet.isPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {street.name}
                </h1>
                {street.neighborhood && (
                  <p className="text-sm text-gray-500 mt-1">
                    {street.neighborhood}
                  </p>
                )}
                {street.cep && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    CEP {street.cep}
                  </p>
                )}
              </div>
              {isGerente && (
                <div className="flex gap-2">
                  <button
                    onClick={startEdit}
                    className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg hover:bg-blue-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivateStreet.isPending}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded-lg hover:bg-red-50"
                  >
                    Desativar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Clientes nesta rua */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Clientes nesta rua ({clients?.length ?? 0})
        </h2>
        {!clients || clients.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Nenhum cliente vinculado a esta rua
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {clients.map((item) => (
              <Link
                key={item.id}
                href={`/clientes/${item.client_id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.client.name}
                  </p>
                  <div className="flex gap-3 mt-0.5">
                    {item.client.phone && (
                      <span className="text-xs text-gray-400">
                        {item.client.phone}
                      </span>
                    )}
                    {item.house_number && (
                      <span className="text-xs text-gray-400">
                        nº {item.house_number}
                      </span>
                    )}
                    {item.reference && (
                      <span className="text-xs text-gray-400">
                        {item.reference}
                      </span>
                    )}
                  </div>
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
        )}
      </div>
    </div>
  );
}
