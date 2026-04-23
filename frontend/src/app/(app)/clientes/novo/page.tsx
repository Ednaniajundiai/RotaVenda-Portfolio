"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateClient } from "@/hooks/useClients";
import { useAuth } from "@/providers/AuthProvider";

export default function NovoClientePage() {
  const router = useRouter();
  const createClient = useCreateClient();
  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
    opening_balance: "",
  });
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    const opening_balance = parseFloat(
      form.opening_balance.replace(",", ".") || "0"
    );
    if (isNaN(opening_balance) || opening_balance < 0) {
      setError("Saldo inicial inválido");
      return;
    }
    try {
      const client = await createClient.mutateAsync({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        notes: form.notes.trim() || undefined,
        opening_balance: opening_balance || undefined,
      });
      router.push(`/clientes/${client.id}`);
    } catch {
      setError("Erro ao cadastrar cliente");
    }
  }

  return (
    <div className="max-w-lg">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/clientes" className="hover:text-gray-700">
          Clientes
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Novo cliente</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h1 className="text-lg font-bold text-gray-900 mb-5">Novo cliente</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome completo do cliente"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telefone
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(11) 99999-9999"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Informações adicionais..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {isGerente && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Saldo inicial (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={form.opening_balance}
                onChange={(e) =>
                  setForm({ ...form, opening_balance: e.target.value })
                }
                placeholder="0,00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Débito herdado de vendas anteriores ao sistema
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={createClient.isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createClient.isPending ? "Salvando..." : "Cadastrar"}
            </button>
            <Link
              href="/clientes"
              className="text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
