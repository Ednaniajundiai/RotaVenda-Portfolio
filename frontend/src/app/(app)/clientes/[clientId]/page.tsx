"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import {
  useAddClientToStreet,
  useClient,
  useClientBalance,
  useClientStatement,
  useClientStreets,
  useDeactivateClient,
  useRemoveClientFromStreet,
  useUpdateClient,
} from "@/hooks/useClients";
import { useSaleInstallments } from "@/hooks/useSales";
import { useStreets } from "@/hooks/useStreets";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { StatementEntry } from "@/types/client";

// ---------- helpers WhatsApp ----------

function buildWppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function buildDetailedWppMessage(
  name: string,
  saldo: number,
  entries: StatementEntry[]
): string {
  const pending = entries.filter(
    (e) =>
      e.type === "sale" &&
      e.payment_mode === "FIADO" &&
      (e.installments_pending ?? 0) > 0
  );
  const lines: string[] = [
    `Olá *${name}*,`,
    ``,
    `Você possui saldo devedor de *${formatCurrency(saldo)}*.`,
  ];
  if (pending.length > 0) {
    lines.push(``, `Compras em aberto:`);
    pending.forEach((e) =>
      lines.push(
        `• ${formatDate(e.date)} — ${e.installments_pending}/${e.installments_count} parcela(s) — ${formatCurrency(e.amount)}`
      )
    );
  }
  lines.push(``, `Entre em contato para regularizar.`);
  return lines.join("\n");
}

// ---------- sub-componentes ----------

function InstallmentRows({ saleId }: { saleId: string }) {
  const { data: installments, isLoading } = useSaleInstallments(saleId);

  const STATUS_COLOR: Record<string, string> = {
    PAID: "bg-green-100 text-green-700",
    PARTIAL: "bg-yellow-100 text-yellow-700",
    PENDING: "bg-gray-100 text-gray-600",
    OVERDUE: "bg-red-100 text-red-700",
  };
  const STATUS_LABEL: Record<string, string> = {
    PAID: "Pago",
    PARTIAL: "Parcial",
    PENDING: "Pendente",
    OVERDUE: "Vencida",
  };

  if (isLoading) {
    return (
      <div className="px-4 py-2 text-xs text-gray-400">
        Carregando parcelas...
      </div>
    );
  }

  if (!installments || installments.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-gray-50 bg-gray-50">
      {installments.map((inst) => (
        <div
          key={inst.id}
          className="flex items-center justify-between px-6 py-2"
        >
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-xs px-1.5 py-0.5 rounded font-medium",
                STATUS_COLOR[inst.status] ?? "bg-gray-100 text-gray-600"
              )}
            >
              {STATUS_LABEL[inst.status] ?? inst.status}
            </span>
            <span className="text-xs text-gray-500">
              Parcela {inst.number} · venc.{" "}
              {new Date(inst.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-gray-700">
              {formatCurrency(inst.amount)}
            </span>
            {inst.paid_amount > 0 && (
              <span className="text-xs text-green-600 ml-1">
                (pago {formatCurrency(inst.paid_amount)})
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- página principal ----------

type StatementTab = "todos" | "vendas" | "pagamentos";
type PeriodFilter = "30d" | "90d" | "tudo";

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.clientId as string;

  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const { data: client, isLoading } = useClient(clientId);
  const { data: balance } = useClientBalance(clientId);
  const { data: statement } = useClientStatement(clientId);
  const { data: clientStreets, isLoading: loadingStreets } =
    useClientStreets(clientId);
  const { data: allStreets } = useStreets();

  const updateClient = useUpdateClient(clientId);
  const deactivateClient = useDeactivateClient();
  const addToStreet = useAddClientToStreet(clientId);
  const removeFromStreet = useRemoveClientFromStreet(clientId);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    notes: "",
    opening_balance: "",
  });
  const [formError, setFormError] = useState("");

  const [expandedSaleId, setExpandedSaleId] = useState<string | null>(null);

  const [showAddStreet, setShowAddStreet] = useState(false);
  const [addStreetForm, setAddStreetForm] = useState({
    street_id: "",
    house_number: "",
    reference: "",
  });
  const [addStreetError, setAddStreetError] = useState("");

  const [statementTab, setStatementTab] = useState<StatementTab>("todos");
  const [period, setPeriod] = useState<PeriodFilter>("tudo");

  const [streetSearch, setStreetSearch] = useState("");
  const [streetNeighborhoodFilter, setStreetNeighborhoodFilter] = useState("all");
  const [streetSortOrder, setStreetSortOrder] = useState<"asc" | "desc">("asc");

  const uniqueNeighborhoods = useMemo(() => {
    if (!clientStreets) return [];
    const neighborhoods = clientStreets
      .map((cs) => cs.street.neighborhood)
      .filter((n): n is string => Boolean(n));
    return Array.from(new Set(neighborhoods)).sort();
  }, [clientStreets]);

  const filteredAndSortedStreets = useMemo(() => {
    if (!clientStreets) return [];
    let result = [...clientStreets];

    if (streetSearch) {
      const lowerTerms = streetSearch.toLowerCase();
      result = result.filter((cs) =>
        cs.street.name.toLowerCase().includes(lowerTerms)
      );
    }

    if (streetNeighborhoodFilter !== "all") {
      result = result.filter(
        (cs) => cs.street.neighborhood === streetNeighborhoodFilter
      );
    }

    result.sort((a, b) => {
      const cmp = a.street.name.localeCompare(b.street.name);
      return streetSortOrder === "asc" ? cmp : -cmp;
    });

    return result;
  }, [clientStreets, streetSearch, streetNeighborhoodFilter, streetSortOrder]);

  function startEdit() {
    if (!client) return;
    setForm({
      name: client.name,
      phone: client.phone ?? "",
      notes: client.notes ?? "",
      opening_balance: client.opening_balance
        ? String(client.opening_balance.toFixed(2)).replace(".", ",")
        : "",
    });
    setEditing(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Nome é obrigatório");
      return;
    }
    const updateData: Parameters<typeof updateClient.mutateAsync>[0] = {
      name: form.name.trim(),
      phone: form.phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };
    if (isGerente && form.opening_balance.trim() !== "") {
      const ob = parseFloat(form.opening_balance.replace(",", "."));
      if (isNaN(ob) || ob < 0) {
        setFormError("Saldo inicial inválido");
        return;
      }
      updateData.opening_balance = ob;
    }
    try {
      await updateClient.mutateAsync(updateData);
      setEditing(false);
      setFormError("");
    } catch {
      setFormError("Erro ao atualizar cliente");
    }
  }

  async function handleDeactivate() {
    if (!confirm("Desativar este cliente?")) return;
    await deactivateClient.mutateAsync(clientId);
    router.push("/clientes");
  }

  async function handleAddStreet(e: React.FormEvent) {
    e.preventDefault();
    if (!addStreetForm.street_id) {
      setAddStreetError("Selecione uma rua");
      return;
    }
    try {
      await addToStreet.mutateAsync({
        street_id: addStreetForm.street_id,
        house_number: addStreetForm.house_number.trim() || undefined,
        reference: addStreetForm.reference.trim() || undefined,
      });
      setAddStreetForm({ street_id: "", house_number: "", reference: "" });
      setAddStreetError("");
      setShowAddStreet(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Erro ao vincular rua";
      setAddStreetError(msg);
    }
  }

  async function handleRemoveStreet(streetId: string, streetName: string) {
    if (!confirm(`Remover "${streetName}" deste cliente?`)) return;
    await removeFromStreet.mutateAsync(streetId);
  }

  const linkedStreetIds = new Set(
    (clientStreets ?? []).map((cs) => cs.street_id)
  );
  const availableStreets = (allStreets ?? []).filter(
    (s) => !linkedStreetIds.has(s.id)
  );

  // Filtragem do extrato (client-side)
  const filteredEntries = useMemo(() => {
    if (!statement) return [];

    let entries = statement.entries;

    if (statementTab === "vendas") {
      entries = entries.filter((e) => e.type === "sale");
    } else if (statementTab === "pagamentos") {
      entries = entries.filter((e) => e.type === "payment");
    }

    if (period !== "tudo") {
      const days = period === "30d" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      entries = entries.filter((e) => e.date >= cutoffStr);
    }

    return entries;
  }, [statement, statementTab, period]);

  // Badge OVERDUE: alguma venda FIADO com parcelas pendentes e a primeira data vencida
  const hasOverdue = useMemo(() => {
    if (!statement) return false;
    const today = new Date().toISOString().slice(0, 10);
    return statement.entries.some(
      (e) =>
        e.type === "sale" &&
        e.payment_mode === "FIADO" &&
        (e.installments_pending ?? 0) > 0 &&
        e.date < today
    );
  }, [statement]);

  if (isLoading) {
    return (
      <div className="text-center py-10 text-gray-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        Cliente não encontrado.{" "}
        <Link href="/clientes" className="text-blue-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  const saldo = balance?.saldo ?? 0;
  const showWpp = !!(client.phone && saldo > 0);

  return (
    <div className="max-w-2xl pb-40 md:pb-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <Link href="/clientes" className="hover:text-gray-700">
          Clientes
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{client.name}</span>
      </div>

      {/* Dados do cliente */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Editar cliente
            </h2>
            <div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateClient.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {updateClient.isPending ? "Salvando..." : "Salvar"}
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
                  {client.name}
                </h1>
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="text-sm text-blue-500 hover:underline mt-1 block"
                  >
                    {client.phone}
                  </a>
                )}
                {client.notes && (
                  <p className="text-sm text-gray-400 mt-1 italic">
                    {client.notes}
                  </p>
                )}
                {!client.is_active && (
                  <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Inativo
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={startEdit}
                  className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1 rounded-lg hover:bg-blue-50"
                >
                  Editar
                </button>
                {isGerente && (
                  <button
                    onClick={handleDeactivate}
                    className="text-sm text-red-600 hover:text-red-800 px-3 py-1 rounded-lg hover:bg-red-50"
                  >
                    Desativar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Saldo */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Saldo devedor</p>
            <p
              className={cn(
                "text-3xl font-bold",
                saldo > 0
                  ? "text-red-600"
                  : saldo < 0
                  ? "text-green-600"
                  : "text-gray-400"
              )}
            >
              {balance !== undefined ? formatCurrency(saldo) : "—"}
            </p>
            {saldo === 0 && (
              <p className="text-xs text-gray-400 mt-1">Sem débitos pendentes</p>
            )}
            {saldo > 0 && client.opening_balance > 0 && (
              <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                <div className="flex gap-2">
                  <span>Saldo inicial:</span>
                  <span>{formatCurrency(client.opening_balance)}</span>
                </div>
                <div className="flex gap-2">
                  <span>Parcelas pendentes:</span>
                  <span>
                    {formatCurrency(saldo - client.opening_balance)}
                  </span>
                </div>
              </div>
            )}
            {hasOverdue && saldo > 0 && (
              <span className="inline-block mt-2 text-xs bg-red-100 text-red-700 font-semibold px-2 py-0.5 rounded-full">
                VENCIDO
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            {saldo > 0 && (
              <Link
                href={`/clientes/${clientId}/pagamento`}
                className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Registrar pagamento
              </Link>
            )}
            {showWpp && (
              <a
                href={buildWppUrl(
                  client.phone!,
                  buildDetailedWppMessage(
                    client.name,
                    saldo,
                    statement?.entries ?? []
                  )
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-4 h-4 fill-white shrink-0"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Cobrar WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Ruas vinculadas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Ruas vinculadas ({clientStreets?.length ?? 0})
          </h2>
          <button
            onClick={() => setShowAddStreet(!showAddStreet)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showAddStreet ? "Cancelar" : "+ Vincular rua"}
          </button>
        </div>

        {/* Filtros e ordenação de ruas */}
        {clientStreets && clientStreets.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-2 mb-4 bg-gray-50 p-2 text-sm rounded-lg border border-gray-100">
            <input
              type="text"
              placeholder="Buscar rua..."
              value={streetSearch}
              onChange={(e) => setStreetSearch(e.target.value)}
              className="flex-1 border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {uniqueNeighborhoods.length > 0 && (
              <select
                value={streetNeighborhoodFilter}
                onChange={(e) => setStreetNeighborhoodFilter(e.target.value)}
                className="border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Bairro (Todos)</option>
                {uniqueNeighborhoods.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
            <select
              value={streetSortOrder}
              onChange={(e) => setStreetSortOrder(e.target.value as "asc" | "desc")}
              className="border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 w-24"
            >
              <option value="asc">A-Z</option>
              <option value="desc">Z-A</option>
            </select>
          </div>
        )}

        {showAddStreet && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-3">
            <form onSubmit={handleAddStreet} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rua <span className="text-red-500">*</span>
                </label>
                <select
                  value={addStreetForm.street_id}
                  onChange={(e) =>
                    setAddStreetForm({
                      ...addStreetForm,
                      street_id: e.target.value,
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Selecione uma rua...</option>
                  {availableStreets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.neighborhood ? ` — ${s.neighborhood}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Número
                  </label>
                  <input
                    type="text"
                    value={addStreetForm.house_number}
                    onChange={(e) =>
                      setAddStreetForm({
                        ...addStreetForm,
                        house_number: e.target.value,
                      })
                    }
                    placeholder="Ex.: 123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referência
                  </label>
                  <input
                    type="text"
                    value={addStreetForm.reference}
                    onChange={(e) =>
                      setAddStreetForm({
                        ...addStreetForm,
                        reference: e.target.value,
                      })
                    }
                    placeholder="Ex.: Casa amarela"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {addStreetError && (
                <p className="text-sm text-red-600">{addStreetError}</p>
              )}
              <button
                type="submit"
                disabled={addToStreet.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {addToStreet.isPending ? "Vinculando..." : "Vincular"}
              </button>
            </form>
          </div>
        )}

        {loadingStreets ? (
          <div className="text-center py-6 text-gray-400 text-sm">
            Carregando...
          </div>
        ) : !clientStreets || clientStreets.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Nenhuma rua vinculada
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {clientStreets.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <Link
                    href={`/ruas/${item.street_id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600"
                  >
                    {item.street.name}
                  </Link>
                  <div className="flex gap-3 mt-0.5">
                    {item.street.neighborhood && (
                      <span className="text-xs text-gray-400">
                        {item.street.neighborhood}
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
                {isGerente && (
                  <button
                    onClick={() =>
                      handleRemoveStreet(item.street_id, item.street.name)
                    }
                    className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Barra de ação rápida (mobile) ── */}
      <div className="fixed bottom-16 inset-x-0 bg-white border-t border-gray-200 px-4 py-3 flex gap-3 md:hidden z-10 shadow-lg">
        <Link
          href={`/clientes/${clientId}/pagamento?tab=venda`}
          className="flex-1 py-3.5 bg-blue-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-blue-700 active:bg-blue-800 transition-colors"
        >
          Nova Venda
        </Link>
        {saldo > 0 && (
          <Link
            href={`/clientes/${clientId}/pagamento?tab=pagamento`}
            className="flex-1 py-3.5 bg-green-600 text-white rounded-xl text-sm font-semibold text-center hover:bg-green-700 active:bg-green-800 transition-colors"
          >
            Receber Pagamento
          </Link>
        )}
      </div>

      {/* Extrato */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Extrato ({filteredEntries.length})
          </h2>
          {/* Filtro de período */}
          <div className="flex gap-1">
            {(["30d", "90d", "tudo"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors",
                  period === p
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {p === "tudo" ? "Tudo" : p}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs tipo */}
        <div className="flex gap-1 mb-3">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "vendas", label: "Vendas" },
              { key: "pagamentos", label: "Pagamentos" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatementTab(key)}
              className={cn(
                "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                statementTab === key
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {!statement || filteredEntries.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            Nenhuma movimentação encontrada
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {filteredEntries.map((entry) => (
              <div key={entry.type + entry.id}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={cn(
                          "shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded",
                          entry.type === "payment"
                            ? "bg-green-100 text-green-700"
                            : entry.payment_mode === "FIADO"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        )}
                      >
                        {entry.type === "payment"
                          ? "Pag"
                          : entry.payment_mode === "FIADO"
                          ? "Fiado"
                          : "Venda"}
                      </span>
                      <p className="text-sm text-gray-500 truncate">
                        {entry.description ??
                          (entry.type === "payment" ? "Pagamento" : "Venda")}
                      </p>
                      {entry.type === "sale" &&
                        entry.payment_mode === "FIADO" &&
                        entry.installments_count != null && (
                          <button
                            onClick={() =>
                              setExpandedSaleId(
                                expandedSaleId === entry.id ? null : entry.id
                              )
                            }
                            className={cn(
                              "shrink-0 text-xs px-1.5 py-0.5 rounded font-medium",
                              entry.installments_pending === 0
                                ? "bg-green-100 text-green-700"
                                : "bg-orange-100 text-orange-700"
                            )}
                          >
                            {entry.installments_pending === 0
                              ? "Quitado"
                              : `${entry.installments_pending}/${entry.installments_count} pendentes`}
                          </button>
                        )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(entry.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-bold ml-3",
                      entry.type === "payment"
                        ? "text-green-600"
                        : entry.payment_mode === "FIADO"
                        ? "text-orange-600"
                        : "text-blue-600"
                    )}
                  >
                    {entry.type === "payment" ? "−" : "+"}
                    {formatCurrency(entry.amount)}
                  </span>
                </div>
                {entry.type === "sale" && expandedSaleId === entry.id && (
                  <InstallmentRows saleId={entry.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
