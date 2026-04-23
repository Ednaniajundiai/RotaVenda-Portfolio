"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useDebounce } from "@/hooks/useDebounce";
import {
  useClientNeighborhoods,
  useClientStreetsFilter,
  useClients,
} from "@/hooks/useClients";
import { cn, formatCurrency } from "@/lib/utils";
import { Client } from "@/types/client";

const FILTER_LABELS: Record<string, string> = {
  todos: "Todos",
  com_debito: "Com débito",
  quitados: "Quitados",
};

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "nome", label: "Nome (A-Z)" },
  { value: "saldo_desc", label: "Maior débito" },
  { value: "saldo_asc", label: "Menor débito" },
  { value: "recente", label: "Mais recente" },
];

const LIMIT_OPTIONS = [
  { value: 20, label: "20 / pág." },
  { value: 50, label: "50 / pág." },
  { value: 100, label: "100 / pág." },
  { value: 500, label: "Todos" },
];

const WPP_PATH =
  "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z";

function buildSimpleWppMessage(name: string, saldo: number): string {
  return `Olá *${name}*,\n\nPassando para informar que você possui um saldo devedor de *${formatCurrency(saldo)}*.\n\nEm caso de dúvidas, entre em contato conosco.`;
}

function buildWppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function buildWppHref(client: Client): string {
  const digits = client.phone!.replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  if (client.saldo > 0) {
    return buildWppUrl(client.phone!, buildSimpleWppMessage(client.name, client.saldo));
  }
  return `https://wa.me/${number}`;
}

function ClientTableRow({ client }: { client: Client }) {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3">
        <Link
          href={`/clientes/${client.id}`}
          className="text-sm font-medium text-gray-900 hover:text-blue-600"
        >
          {client.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {client.primary_neighborhood ?? (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500">
        {client.primary_street ?? <span className="text-gray-300">—</span>}
      </td>
      <td className="px-4 py-3">
        {client.phone ? (
          <a
            href={`tel:${client.phone}`}
            className="text-sm text-blue-500 hover:underline"
          >
            {client.phone}
          </a>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {client.phone ? (
          <a
            href={buildWppHref(client)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors",
              client.saldo > 0
                ? "bg-green-500 hover:bg-green-600"
                : "bg-gray-300 hover:bg-gray-400"
            )}
            title={
              client.saldo > 0
                ? "Enviar cobrança pelo WhatsApp"
                : "Abrir conversa no WhatsApp"
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4 h-4 fill-white"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d={WPP_PATH} />
            </svg>
          </a>
        ) : (
          <span className="text-gray-200 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            "text-sm font-semibold",
            client.saldo > 0
              ? "text-red-600"
              : client.saldo < 0
              ? "text-green-600"
              : "text-gray-400"
          )}
        >
          {formatCurrency(client.saldo)}
        </span>
      </td>
    </tr>
  );
}

function getVisiblePages(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current < 4) return [0, 1, 2, 3, 4, "...", total - 1];
  if (current > total - 5) return [0, "...", total - 5, total - 4, total - 3, total - 2, total - 1];
  return [0, "...", current - 1, current, current + 1, "...", total - 1];
}

function emptyMessage(
  filter: string,
  neighborhood: string,
  streetName: string,
  search: string
): string {
  if (search) return `Nenhum cliente encontrado para "${search}"`;
  if (filter === "com_debito") return "Nenhum cliente com débito encontrado";
  if (filter === "quitados") return "Nenhum cliente quitado encontrado";
  if (streetName) return `Nenhum cliente na rua "${streetName}"`;
  if (neighborhood) return `Nenhum cliente no bairro "${neighborhood}"`;
  return "Nenhum cliente encontrado";
}

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(20);
  const [filter, setFilter] = useState<"todos" | "com_debito" | "quitados">(
    "todos"
  );
  const [neighborhood, setNeighborhood] = useState("");
  const [streetId, setStreetId] = useState("");
  const [sort, setSort] = useState<
    "nome" | "saldo_desc" | "saldo_asc" | "recente"
  >("nome");

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, filter, neighborhood, streetId, sort, limit]);

  function handleNeighborhoodChange(value: string) {
    setNeighborhood(value);
    setStreetId("");
    setPage(0);
  }

  const { data, isLoading } = useClients({
    search: debouncedSearch || undefined,
    page,
    limit,
    filter,
    neighborhood: neighborhood || undefined,
    street_id: streetId || undefined,
    sort,
  });

  const { data: debtData } = useClients({
    filter: "com_debito",
    limit: 1,
    neighborhood: neighborhood || undefined,
    street_id: streetId || undefined,
  });
  const { data: neighborhoods } = useClientNeighborhoods();
  const { data: streetsForFilter } = useClientStreetsFilter(
    neighborhood || undefined
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const totalComDebito = debtData?.total ?? 0;
  const totalSaldo = data?.totalSaldo ?? 0;

  const selectedStreet = (streetsForFilter ?? []).find((s) => s.id === streetId);
  const hasActiveFilter = filter !== "todos" || !!neighborhood || !!streetId;

  function clearFilters() {
    setFilter("todos");
    setNeighborhood("");
    setStreetId("");
    setPage(0);
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} cliente(s) cadastrado(s)
          </p>
        </div>
        <Link
          href="/clientes/novo"
          className="w-full sm:w-auto text-center bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Novo cliente
        </Link>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{total}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Débito</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{totalComDebito}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">A receber</p>
          <p className="text-xl sm:text-2xl font-bold text-orange-600 truncate">
            {formatCurrency(totalSaldo)}
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Filtros de saldo */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {(["todos", "com_debito", "quitados"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(0);
            }}
            className={cn(
              "px-3 py-1 rounded-full text-sm font-medium transition-colors",
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Controles: bairro, rua, ordenação, limite */}
      <div className="flex gap-2 mb-3 flex-wrap">
        <select
          value={neighborhood}
          onChange={(e) => handleNeighborhoodChange(e.target.value)}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Todos os bairros</option>
          {(neighborhoods ?? []).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        <select
          value={streetId}
          onChange={(e) => {
            setStreetId(e.target.value);
            setPage(0);
          }}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          disabled={!streetsForFilter || streetsForFilter.length === 0}
        >
          <option value="">Todas as ruas</option>
          {(streetsForFilter ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as typeof sort);
            setPage(0);
          }}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(0);
          }}
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {LIMIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Chips de filtros ativos */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {filter !== "todos" && (
            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
              {FILTER_LABELS[filter]}
              <button onClick={() => setFilter("todos")} className="hover:text-blue-900">
                ×
              </button>
            </span>
          )}
          {neighborhood && (
            <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
              {neighborhood}
              <button onClick={() => handleNeighborhoodChange("")} className="hover:text-purple-900">
                ×
              </button>
            </span>
          )}
          {streetId && selectedStreet && (
            <span className="inline-flex items-center gap-1 bg-teal-100 text-teal-700 text-xs px-2 py-1 rounded-full">
              Rua: {selectedStreet.name}
              <button onClick={() => setStreetId("")} className="hover:text-teal-900">
                ×
              </button>
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista / Tabela */}
      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Carregando...
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          {emptyMessage(
            filter,
            neighborhood,
            selectedStreet?.name ?? "",
            debouncedSearch
          )}
        </div>
      ) : (
        <>
          {/* Card-list — mobile */}
          <div className="sm:hidden space-y-2">
            {items.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-xl border border-gray-200 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/clientes/${client.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600 text-sm leading-snug"
                  >
                    {client.name}
                  </Link>
                  <span
                    className={cn(
                      "text-sm font-bold shrink-0",
                      client.saldo > 0
                        ? "text-red-600"
                        : client.saldo < 0
                        ? "text-green-600"
                        : "text-gray-400"
                    )}
                  >
                    {formatCurrency(client.saldo)}
                  </span>
                </div>

                {(client.primary_neighborhood || client.primary_street) && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {[client.primary_neighborhood, client.primary_street]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}

                <div className="flex items-center justify-between mt-2">
                  {client.phone ? (
                    <a
                      href={`tel:${client.phone}`}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-300">Sem telefone</span>
                  )}

                  {client.phone && (
                    <a
                      href={buildWppHref(client)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors",
                        client.saldo > 0
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-gray-300 hover:bg-gray-400"
                      )}
                      title={
                        client.saldo > 0
                          ? "Enviar cobrança pelo WhatsApp"
                          : "Abrir conversa no WhatsApp"
                      }
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 fill-white"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d={WPP_PATH} />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Tabela — desktop */}
          <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Bairro
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Rua
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Telefone
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center w-12">
                    WPP
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                    Saldo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((client) => (
                  <ClientTableRow key={client.id} client={client} />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex flex-col items-center gap-2 mt-6">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ‹
            </button>

            {getVisiblePages(page, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 py-1.5 text-sm text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    "min-w-[2rem] px-2 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                    page === p
                      ? "bg-blue-600 text-white border-blue-600"
                      : "text-gray-700 bg-white border-gray-300 hover:bg-gray-50"
                  )}
                >
                  {(p as number) + 1}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ›
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Exibindo {page * limit + 1}–{Math.min((page + 1) * limit, total)} de {total} clientes
          </p>
        </div>
      )}
    </div>
  );
}
