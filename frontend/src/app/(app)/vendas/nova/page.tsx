"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { ProductPicker } from "@/components/rota/ProductPicker";
import {
  useClientBalance,
  useClientNeighborhoods,
  useClients,
} from "@/hooks/useClients";
import { useCreateSale } from "@/hooks/useSales";
import {
  dueDateFromNow,
  saleFormSchema as schema,
  SaleFormValues as FormValues,
} from "@/lib/schemas/sale";
import { cn, formatCurrency } from "@/lib/utils";
import { Client } from "@/types/client";
import { Product } from "@/types/product";

type Step = "cliente" | "produtos" | "pagamento";

export default function NovaVendaPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("cliente");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientNeighborhood, setClientNeighborhood] = useState("");
  const [clientSort, setClientSort] = useState<"asc" | "desc">("asc");
  const [newlyAddedIndex, setNewlyAddedIndex] = useState(-1);
  const [itemStocks, setItemStocks] = useState<Record<number, number>>({});
  const [submitError, setSubmitError] = useState("");

  const { data: clientsData } = useClients({ limit: 500 });
  const { data: neighborhoods } = useClientNeighborhoods();
  const { data: balance } = useClientBalance(selectedClient?.id ?? "");
  const createSale = useCreateSale();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: [],
      discount: 0,
      payment_mode: "FIADO",
      installments: [{ number: 1, due_date: dueDateFromNow(1), amount: 0 }],
    },
  });

  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({ control, name: "items" });

  const {
    fields: installmentFields,
    append: appendInstallment,
    remove: removeInstallment,
    replace: replaceInstallments,
  } = useFieldArray({ control, name: "installments" });

  const paymentMode = watch("payment_mode");
  const itemsWatch = watch("items");
  const discount = watch("discount") || 0;
  const installmentsWatch = watch("installments");

  const subtotal = itemsWatch.reduce(
    (s, i) => s + (i.quantity || 0) * (i.unit_price || 0),
    0
  );
  const total = Math.max(0, subtotal - discount);
  const installmentsSum = installmentsWatch.reduce(
    (s, i) => s + (i.amount || 0),
    0
  );
  const installmentsDiff = installmentsSum - total;
  const installmentsOk = Math.abs(installmentsDiff) <= 0.01;

  // ── Clientes filtrados ────────────────────────────────────────────────────

  const filteredClients = (() => {
    let list = clientsData?.items ?? [];
    if (clientSearch.trim())
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
          c.phone?.includes(clientSearch)
      );
    if (clientNeighborhood)
      list = list.filter((c) => c.primary_neighborhood === clientNeighborhood);
    return [...list].sort((a, b) =>
      clientSort === "asc"
        ? a.name.localeCompare(b.name, "pt")
        : b.name.localeCompare(a.name, "pt")
    );
  })();

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSelectClient(client: Client) {
    setSelectedClient(client);
    setStep("produtos");
  }

  function flashHighlight(index: number) {
    setNewlyAddedIndex(index);
    setTimeout(() => setNewlyAddedIndex(-1), 900);
  }

  function handleProductSelect(product: Product) {
    const existingIndex = itemsWatch.findIndex(
      (i) => i.product_id === product.id
    );
    if (existingIndex >= 0) {
      const currentQty = itemsWatch[existingIndex].quantity || 0;
      setValue(`items.${existingIndex}.quantity`, currentQty + 1);
      flashHighlight(existingIndex);
    } else {
      const newIndex = itemFields.length;
      appendItem({
        product_id: product.id,
        product_name: product.name,
        unit_measure: product.unit_measure,
        quantity: 1,
        unit_price: product.price,
      });
      setItemStocks((prev) => ({
        ...prev,
        [newIndex]: product.current_stock,
      }));
      flashHighlight(newIndex);
    }
  }

  function handlePaymentModeChange(mode: "A_VISTA" | "FIADO") {
    setValue("payment_mode", mode);
    if (mode === "FIADO") {
      replaceInstallments([
        { number: 1, due_date: dueDateFromNow(1), amount: total || 0 },
      ]);
    } else {
      replaceInstallments([]);
    }
  }

  function handleSplitInstallments() {
    if (installmentFields.length === 0 || total <= 0) return;
    const count = installmentFields.length;
    const base = Math.floor((total / count) * 100) / 100;
    const remainder = Math.round((total - base * count) * 100) / 100;
    replaceInstallments(
      installmentFields.map((_, i) => ({
        number: i + 1,
        due_date: dueDateFromNow(i + 1),
        amount: i === count - 1 ? base + remainder : base,
      }))
    );
  }

  function handleAddInstallment() {
    const nextNumber = installmentFields.length + 1;
    appendInstallment({
      number: nextNumber,
      due_date: dueDateFromNow(nextNumber),
      amount: 0,
    });
  }

  async function handleFormSubmit(values: FormValues) {
    if (!selectedClient) return;
    setSubmitError("");
    try {
      await createSale.mutateAsync({
        client_id: selectedClient.id,
        sale_type: "LOJA",
        payment_mode: values.payment_mode,
        items: values.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
        })),
        discount: values.discount || 0,
        installments:
          values.payment_mode === "FIADO" && values.installments.length > 0
            ? values.installments.map((i) => ({
                number: i.number,
                due_date: i.due_date,
                amount: i.amount,
              }))
            : undefined,
        description: values.description || undefined,
      });
      router.push("/vendas");
    } catch {
      setSubmitError("Erro ao registrar venda. Tente novamente.");
    }
  }

  const itemsError = errors.items as { message?: string } | undefined;
  const installmentsError = errors.installments as
    | { message?: string }
    | undefined;

  // ── Step labels ───────────────────────────────────────────────────────────

  const STEPS: { key: Step; label: string }[] = [
    { key: "cliente", label: "Cliente" },
    { key: "produtos", label: "Produtos" },
    { key: "pagamento", label: "Pagamento" },
  ];

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Linha 1: voltar + steps */}
          <div className="flex items-center gap-3">
            <Link
              href="/vendas"
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              Vendas
            </Link>

            {/* Breadcrumb de steps */}
            <div className="flex items-center gap-1 overflow-hidden">
              {STEPS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1 min-w-0">
                  {i > 0 && (
                    <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-semibold truncate",
                      i === stepIndex
                        ? "text-blue-600"
                        : i < stepIndex
                          ? "text-gray-400"
                          : "text-gray-300"
                    )}
                  >
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Linha 2: nome do cliente fixado */}
          {selectedClient && (
            <div className="mt-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">
                  {selectedClient.name}
                </span>
                {balance != null && (
                  <span
                    className={cn(
                      "text-xs font-semibold px-2 py-0.5 rounded-full",
                      balance.saldo > 0.005
                        ? "bg-red-100 text-red-600"
                        : balance.saldo < -0.005
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {balance.saldo > 0.005
                      ? `Deve ${formatCurrency(balance.saldo)}`
                      : balance.saldo < -0.005
                        ? `Crédito ${formatCurrency(Math.abs(balance.saldo))}`
                        : "Sem débito"}
                  </span>
                )}
              </div>
              {step !== "cliente" && (
                <button
                  type="button"
                  onClick={() => setStep("cliente")}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                >
                  Alterar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Conteúdo do step ─────────────────────────────────────────────── */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-32">

        {/* ══ STEP: CLIENTE ════════════════════════════════════════════════ */}
        {step === "cliente" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">
                Selecione o cliente
              </h2>
            </div>

            {/* Filtros */}
            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
              <input
                autoFocus
                type="text"
                placeholder="Buscar por nome ou telefone..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                {(neighborhoods?.length ?? 0) > 0 && (
                  <select
                    value={clientNeighborhood}
                    onChange={(e) => setClientNeighborhood(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Todos os bairros</option>
                    {neighborhoods!.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={clientSort}
                  onChange={(e) =>
                    setClientSort(e.target.value as "asc" | "desc")
                  }
                  className="border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="asc">A-Z</option>
                  <option value="desc">Z-A</option>
                </select>
              </div>
            </div>

            {/* Lista de clientes */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {filteredClients.length === 0 ? (
                <p className="px-4 py-8 text-sm text-gray-400 text-center">
                  Nenhum cliente encontrado
                </p>
              ) : (
                filteredClients.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 active:bg-blue-100 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {client.name}
                      </p>
                      {client.phone && (
                        <p className="text-xs text-gray-400">{client.phone}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {client.primary_neighborhood && (
                        <span className="text-xs text-gray-400">
                          {client.primary_neighborhood}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ══ STEP: PRODUTOS ═══════════════════════════════════════════════ */}
        {step === "produtos" && (
          <div className="space-y-3">
            {/* ProductPicker */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Produtos
                </span>
              </div>
              <div className="p-3">
                <ProductPicker
                  onSelect={handleProductSelect}
                  gridMaxHeight="260px"
                />
              </div>
            </div>

            {/* Carrinho */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Carrinho
                  </span>
                  {itemFields.length > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                      {itemFields.length}
                    </span>
                  )}
                </div>
              </div>

              {itemFields.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400">
                    Toque em um produto para adicioná-lo
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_88px_36px_72px_64px_28px] gap-x-1.5 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Produto</span>
                    <span className="text-center">Qtd</span>
                    <span className="text-center">Un.</span>
                    <span className="text-right">Preço</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                  <div className="divide-y divide-gray-100">
                    {itemFields.map((field, index) => {
                      const item = itemsWatch[index];
                      const itemSubtotal =
                        (item?.quantity || 0) * (item?.unit_price || 0);
                      const stockAvailable = itemStocks[index];
                      const overStock =
                        stockAvailable !== undefined &&
                        (item?.quantity || 0) > stockAvailable;

                      return (
                        <div
                          key={field.id}
                          className={cn(
                            "px-3 py-2 space-y-1.5 transition-colors duration-300",
                            newlyAddedIndex === index && "bg-blue-50"
                          )}
                        >
                          <div className="grid grid-cols-[1fr_88px_36px_72px_64px_28px] gap-x-1.5 items-center">
                            <span
                              className="text-sm font-medium text-gray-800 truncate"
                              title={item?.product_name}
                            >
                              {item?.product_name || "—"}
                            </span>

                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                aria-label="Diminuir quantidade"
                                onClick={() => {
                                  const v = item?.quantity || 1;
                                  setValue(
                                    `items.${index}.quantity`,
                                    Math.max(
                                      1,
                                      Math.round((v - 1) * 100) / 100
                                    )
                                  );
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 shrink-0"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                inputMode="decimal"
                                aria-label="Quantidade"
                                className="w-8 border border-gray-300 rounded px-0.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                                {...register(`items.${index}.quantity`, {
                                  valueAsNumber: true,
                                })}
                              />
                              <button
                                type="button"
                                aria-label="Aumentar quantidade"
                                onClick={() => {
                                  const v = item?.quantity || 0;
                                  setValue(
                                    `items.${index}.quantity`,
                                    Math.round((v + 1) * 100) / 100
                                  );
                                }}
                                className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 hover:bg-gray-200 text-gray-600 shrink-0"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-[10px] text-gray-400 text-center truncate">
                              {item?.unit_measure || "un"}
                            </span>

                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0,00"
                              inputMode="decimal"
                              aria-label="Preço unitário"
                              className="w-full border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                              {...register(`items.${index}.unit_price`, {
                                valueAsNumber: true,
                              })}
                            />

                            <span className="text-xs font-semibold text-gray-700 text-right tabular-nums">
                              {formatCurrency(itemSubtotal)}
                            </span>

                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              aria-label="Remover item"
                              className="flex items-center justify-center w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>

                          {overStock && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-600">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>
                                Estoque disponível: {stockAvailable}{" "}
                                {item?.unit_measure || "un"}
                              </span>
                            </div>
                          )}

                          {(errors.items?.[index]?.quantity ||
                            errors.items?.[index]?.unit_price) && (
                            <div className="flex gap-3 text-[10px] text-red-500">
                              {errors.items?.[index]?.quantity && (
                                <span>
                                  {errors.items[index].quantity?.message}
                                </span>
                              )}
                              {errors.items?.[index]?.unit_price && (
                                <span>
                                  {errors.items[index].unit_price?.message}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {itemsError?.message && (
                <p className="text-red-500 text-xs px-3 py-2">
                  {itemsError.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP: PAGAMENTO ══════════════════════════════════════════════ */}
        {step === "pagamento" && (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
            {/* Botão voltar */}
            <button
              type="button"
              onClick={() => setStep("produtos")}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar aos produtos
            </button>

            {/* Totais */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <Receipt className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Totais
                </span>
              </div>
              <div className="px-3 py-2 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums font-medium text-gray-700">
                    {formatCurrency(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-3">
                  <label className="text-xs text-gray-500 shrink-0">
                    Desconto (R$)
                  </label>
                  <div className="flex items-center gap-1">
                    {discount > 0 && (
                      <span className="text-xs text-orange-600 tabular-nums">
                        − {formatCurrency(discount)}
                      </span>
                    )}
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      aria-label="Desconto em reais"
                      className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="0,00"
                      {...register("discount", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                {errors.discount && (
                  <p className="text-red-500 text-[10px]">
                    {errors.discount.message}
                  </p>
                )}
                <div className="border-t border-gray-200 pt-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-800">
                      Total
                    </span>
                    <span
                      className={`text-xl font-bold tabular-nums ${
                        total > 0 ? "text-blue-700" : "text-gray-300"
                      }`}
                    >
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Pagamento */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <Wallet className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Pagamento
                </span>
              </div>
              <div className="p-3 space-y-3">
                {/* Toggle */}
                <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-xl overflow-hidden p-0.5 bg-gray-100">
                  {(["A_VISTA", "FIADO"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handlePaymentModeChange(mode)}
                      className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        paymentMode === mode
                          ? mode === "A_VISTA"
                            ? "bg-white shadow-sm text-green-700 border border-green-200"
                            : "bg-white shadow-sm text-orange-700 border border-orange-200"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                    >
                      {mode === "A_VISTA" ? (
                        <>
                          <Banknote className="w-4 h-4" />À vista
                        </>
                      ) : (
                        <>
                          <CalendarDays className="w-4 h-4" />
                          Fiado
                        </>
                      )}
                    </button>
                  ))}
                </div>

                {/* Parcelas */}
                {paymentMode === "FIADO" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">
                        Parcelas ({installmentFields.length}×)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSplitInstallments}
                          disabled={
                            installmentFields.length === 0 || total <= 0
                          }
                          aria-label="Dividir total igualmente"
                          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-300 disabled:cursor-not-allowed flex items-center gap-0.5"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Dividir igualmente
                        </button>
                        <button
                          type="button"
                          onClick={handleAddInstallment}
                          aria-label="Adicionar parcela"
                          className="text-[10px] font-medium text-blue-600 hover:text-blue-800 flex items-center gap-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          Parcela
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[20px_1fr_80px_20px] gap-x-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
                      <span>#</span>
                      <span>Vencimento</span>
                      <span className="text-right">Valor (R$)</span>
                      <span />
                    </div>

                    <div className="space-y-1.5">
                      {installmentFields.map((field, index) => (
                        <div
                          key={field.id}
                          className="grid grid-cols-[20px_1fr_80px_20px] gap-x-2 items-center"
                        >
                          <span className="text-[10px] font-bold text-gray-400 text-center">
                            {index + 1}
                          </span>
                          <input
                            type="date"
                            aria-label={`Data de vencimento da parcela ${index + 1}`}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register(`installments.${index}.due_date`)}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0,00"
                            inputMode="decimal"
                            aria-label={`Valor da parcela ${index + 1}`}
                            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                            {...register(`installments.${index}.amount`, {
                              valueAsNumber: true,
                            })}
                          />
                          {installmentFields.length > 1 ? (
                            <button
                              type="button"
                              onClick={() => removeInstallment(index)}
                              aria-label={`Remover parcela ${index + 1}`}
                              className="flex items-center justify-center w-4 h-4 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      ))}
                    </div>

                    {installmentFields.length > 0 && total > 0 && (
                      <div
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                          installmentsOk
                            ? "bg-green-50 border border-green-200 text-green-700"
                            : installmentsDiff < 0
                              ? "bg-amber-50 border border-amber-200 text-amber-700"
                              : "bg-red-50 border border-red-200 text-red-700"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {installmentsOk ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {installmentsOk
                              ? "Parcelas conferem"
                              : installmentsDiff < 0
                                ? `Falta ${formatCurrency(Math.abs(installmentsDiff))}`
                                : `Excede ${formatCurrency(installmentsDiff)}`}
                          </span>
                        </div>
                        <span className="tabular-nums">
                          {formatCurrency(installmentsSum)} /{" "}
                          {formatCurrency(total)}
                        </span>
                      </div>
                    )}

                    {installmentsError?.message && (
                      <p className="text-red-500 text-xs">
                        {installmentsError.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Observação */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <FileText className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Observação
                </span>
                <span className="text-[10px] text-gray-400">(opcional)</span>
              </div>
              <div className="p-3">
                <input
                  type="text"
                  aria-label="Observação sobre a venda"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-400"
                  placeholder="Ex.: entregue pelo vizinho, aguarda troco..."
                  {...register("description")}
                />
              </div>
            </div>

            {/* Erro de submit */}
            {submitError && (
              <p className="text-sm text-red-600 text-center">{submitError}</p>
            )}

            {/* Botão registrar */}
            <button
              type="submit"
              disabled={createSale.isPending}
              className="w-full py-4 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[52px]"
            >
              {createSale.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Registrar venda
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* ── Barra inferior fixa (somente step "produtos") ────────────────── */}
      {step === "produtos" && (
        <div
          className="fixed bottom-16 inset-x-0 bg-white border-t border-gray-200 z-20 md:hidden"
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">
                {itemFields.length} {itemFields.length === 1 ? "item" : "itens"}
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  total > 0 ? "text-blue-700" : "text-gray-300"
                )}
              >
                {formatCurrency(total)}
              </p>
            </div>
            <button
              type="button"
              disabled={itemFields.length === 0}
              onClick={() => setStep("pagamento")}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Barra inferior para desktop (step "produtos") */}
      {step === "produtos" && (
        <div className="hidden md:block sticky bottom-0 bg-white border-t border-gray-200 mt-auto">
          <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
            <div>
              <p className="text-xs text-gray-500">
                {itemFields.length} {itemFields.length === 1 ? "item" : "itens"}
              </p>
              <p
                className={cn(
                  "text-lg font-bold tabular-nums",
                  total > 0 ? "text-blue-700" : "text-gray-300"
                )}
              >
                {formatCurrency(total)}
              </p>
            </div>
            <button
              type="button"
              disabled={itemFields.length === 0}
              onClick={() => setStep("pagamento")}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Avançar
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
