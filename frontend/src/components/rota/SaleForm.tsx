"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  CalendarDays,
  Check,
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Package,
  Plus,
  Receipt,
  ShoppingCart,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

import { ProductPicker } from "@/components/rota/ProductPicker";
import {
  dueDateFromNow,
  saleFormSchema as schema,
  SaleFormValues as FormValues,
} from "@/lib/schemas/sale";
import { cn, formatCurrency } from "@/lib/utils";
import { Product } from "@/types/product";
import { SaleCreate } from "@/types/sale";

interface SaleFormProps {
  clientId: string;
  routeStreetId?: string;
  saleType?: "ROTA" | "LOJA";
  onSubmit: (data: SaleCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SaleForm({
  clientId,
  routeStreetId,
  saleType = "ROTA",
  onSubmit,
  onCancel,
  isLoading,
}: SaleFormProps) {
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

  const subtotal = itemsWatch.reduce(
    (s, i) => s + (i.quantity || 0) * (i.unit_price || 0),
    0
  );
  const total = Math.max(0, subtotal - discount);

  const installmentsWatch = watch("installments");
  const installmentsSum = installmentsWatch.reduce(
    (s, i) => s + (i.amount || 0),
    0
  );
  const installmentsDiff = installmentsSum - total;
  const installmentsOk = Math.abs(installmentsDiff) <= 0.01;

  // Highlight do item recém adicionado
  const [newlyAddedIndex, setNewlyAddedIndex] = useState(-1);

  // Estoque por linha
  const [itemStocks, setItemStocks] = useState<Record<number, number>>({});

  const handlePaymentModeChange = (mode: "A_VISTA" | "FIADO") => {
    setValue("payment_mode", mode);
    if (mode === "FIADO") {
      replaceInstallments([
        { number: 1, due_date: dueDateFromNow(1), amount: total || 0 },
      ]);
    } else {
      replaceInstallments([]);
    }
  };

  // Adiciona produto via grade — incrementa quantidade se já estiver no carrinho
  const handleProductSelect = (product: Product) => {
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
      setItemStocks((prev) => ({ ...prev, [newIndex]: product.current_stock }));
      flashHighlight(newIndex);
    }
  };

  function flashHighlight(index: number) {
    setNewlyAddedIndex(index);
    setTimeout(() => setNewlyAddedIndex(-1), 900);
  }

  const handleSplitInstallments = () => {
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
  };

  const handleAddInstallment = () => {
    const nextNumber = installmentFields.length + 1;
    appendInstallment({
      number: nextNumber,
      due_date: dueDateFromNow(nextNumber),
      amount: 0,
    });
  };

  const handleFormSubmit = (values: FormValues) => {
    onSubmit({
      client_id: clientId,
      route_street_id: routeStreetId,
      description: values.description || undefined,
      sale_type: saleType,
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
    });
  };

  const itemsError = errors.items as { message?: string } | undefined;
  const installmentsError = errors.installments as
    | { message?: string }
    | undefined;

  // ── Blocos reutilizáveis ───────────────────────────────────────────────────

  const productGrid = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <Package className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Produtos
        </span>
      </div>
      <div className="p-3">
        <ProductPicker onSelect={handleProductSelect} gridMaxHeight="260px" />
      </div>
    </div>
  );

  const cartSection = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
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
        <div className="px-3 py-6 text-center">
          <ShoppingCart className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-xs text-gray-400">
            Toque em um produto para adicioná-lo
          </p>
        </div>
      ) : (
        <>
          {/* Cabeçalho das colunas */}
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
                    {/* Nome do produto */}
                    <span
                      className="text-sm font-medium text-gray-800 truncate"
                      title={item?.product_name}
                    >
                      {item?.product_name || "—"}
                    </span>

                    {/* Qty com botões − / + */}
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Diminuir quantidade"
                        onClick={() => {
                          const v = item?.quantity || 1;
                          setValue(
                            `items.${index}.quantity`,
                            Math.max(1, Math.round((v - 1) * 100) / 100)
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

                    {/* Unidade */}
                    <span className="text-[10px] text-gray-400 text-center truncate">
                      {item?.unit_measure || "un"}
                    </span>

                    {/* Preço unitário */}
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

                    {/* Subtotal */}
                    <span className="text-xs font-semibold text-gray-700 text-right tabular-nums">
                      {formatCurrency(itemSubtotal)}
                    </span>

                    {/* Remover */}
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      aria-label="Remover item"
                      className="flex items-center justify-center w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Aviso de estoque */}
                  {overStock && (
                    <div className="flex items-center gap-1 text-[10px] text-amber-600">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>
                        Estoque disponível: {stockAvailable}{" "}
                        {item?.unit_measure || "un"}
                      </span>
                    </div>
                  )}

                  {/* Erros de linha */}
                  {(errors.items?.[index]?.quantity ||
                    errors.items?.[index]?.unit_price) && (
                    <div className="flex gap-3 text-[10px] text-red-500">
                      {errors.items?.[index]?.quantity && (
                        <span>{errors.items[index].quantity?.message}</span>
                      )}
                      {errors.items?.[index]?.unit_price && (
                        <span>{errors.items[index].unit_price?.message}</span>
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
        <p className="text-red-500 text-xs px-3 py-2">{itemsError.message}</p>
      )}
    </div>
  );

  const totalsSection = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
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
          <p className="text-red-500 text-[10px]">{errors.discount.message}</p>
        )}
        <div className="border-t border-gray-200 pt-1.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-gray-800">Total</span>
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
  );

  const paymentSection = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <Wallet className="w-3.5 h-3.5 text-gray-500" />
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          Pagamento
        </span>
      </div>
      <div className="p-3 space-y-3">
        {/* Toggle À Vista / Fiado */}
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
                  <Banknote className="w-4 h-4" />
                  À vista
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

        {/* Parcelas (FIADO) */}
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
                  disabled={installmentFields.length === 0 || total <= 0}
                  aria-label="Dividir total igualmente entre as parcelas"
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

            {/* Status das parcelas */}
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
                  {formatCurrency(installmentsSum)} / {formatCurrency(total)}
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
  );

  const observationSection = (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
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
  );

  const actionButtons = (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-3.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors min-h-[48px]"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="flex-[2] py-3.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
      >
        {isLoading ? (
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
    </div>
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      {/* ── Layout duas colunas no tablet ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:gap-5 md:items-start">

        {/* Coluna esquerda: produtos + carrinho */}
        <div className="md:w-7/12 space-y-3">
          {productGrid}
          {cartSection}
        </div>

        {/* Coluna direita: totais + pagamento + observação + ações */}
        <div className="md:w-5/12 space-y-3 mt-3 md:mt-0">
          {totalsSection}
          {paymentSection}
          {observationSection}
          {actionButtons}
        </div>
      </div>
    </form>
  );
}
