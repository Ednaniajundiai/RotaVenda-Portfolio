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
  Edit2,
  FileText,
  Loader2,
  Minus,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

import { ProductPicker } from "@/components/rota/ProductPicker";
import { useAuth } from "@/providers/AuthProvider";
import { useDeleteSale, useSale, useUpdateSale } from "@/hooks/useSales";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Product } from "@/types/product";
import { ROLES } from "@/lib/constants";

// ── Schema (mesmo do nova/page.tsx) ──────────────────────────────────────────

const installmentSchema = z.object({
  number: z.number().int().positive(),
  due_date: z.string().min(1, "Informe a data"),
  amount: z
    .number({ invalid_type_error: "Informe o valor" })
    .positive("Valor deve ser maior que zero"),
});

const itemSchema = z.object({
  product_id: z.string().uuid("Selecione um produto"),
  product_name: z.string().min(1),
  unit_measure: z.string(),
  quantity: z
    .number({ invalid_type_error: "Informe a quantidade" })
    .positive("Quantidade deve ser maior que zero"),
  unit_price: z
    .number({ invalid_type_error: "Informe o preço" })
    .positive("Preço deve ser maior que zero"),
});

const schema = z
  .object({
    items: z.array(itemSchema).min(1, "Adicione pelo menos um produto"),
    discount: z
      .number({ invalid_type_error: "Informe o desconto" })
      .min(0, "Desconto não pode ser negativo")
      .optional()
      .default(0),
    description: z.string().optional(),
    payment_mode: z.enum(["A_VISTA", "FIADO"]),
    installments: z.array(installmentSchema),
  })
  .superRefine((data, ctx) => {
    const subtotal = data.items.reduce(
      (s, i) => s + (i.quantity || 0) * (i.unit_price || 0),
      0
    );
    const discount = data.discount || 0;
    const total = subtotal - discount;

    if (discount > 0 && discount >= subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Desconto deve ser menor que o subtotal",
        path: ["discount"],
      });
    }

    if (data.payment_mode === "FIADO" && data.installments.length > 0) {
      const installmentsSum = data.installments.reduce(
        (s, i) => s + i.amount,
        0
      );
      if (Math.abs(installmentsSum - total) > 0.01) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Soma das parcelas (${formatCurrency(installmentsSum)}) deve igual ao total (${formatCurrency(total)})`,
          path: ["installments"],
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

function dueDateFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

const INSTALLMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  PAID: "Pago",
  OVERDUE: "Vencida",
};

const INSTALLMENT_STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PARTIAL: "bg-orange-100 text-orange-700",
  PAID: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [newlyAddedIndex, setNewlyAddedIndex] = useState(-1);

  const { data: sale, isLoading } = useSale(saleId);
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      items: [],
      discount: 0,
      payment_mode: "FIADO",
      installments: [],
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEdit() {
    if (!sale) return;
    reset({
      items: sale.items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        unit_measure: i.unit_measure,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
      discount: sale.discount,
      payment_mode: sale.payment_mode,
      installments: sale.installments.map((i) => ({
        number: i.number,
        due_date: i.due_date,
        amount: i.amount,
      })),
      description: sale.description || "",
    });
    setIsEditing(true);
    setSubmitError("");
  }

  function handleCancel() {
    setIsEditing(false);
    setSubmitError("");
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
    setSubmitError("");
    try {
      await updateSale.mutateAsync({
        id: saleId,
        data: {
          items: values.items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
          discount: values.discount || 0,
          payment_mode: values.payment_mode,
          installments:
            values.payment_mode === "FIADO" && values.installments.length > 0
              ? values.installments.map((i) => ({
                  number: i.number,
                  due_date: i.due_date,
                  amount: i.amount,
                }))
              : undefined,
          description: values.description || undefined,
        },
      });
      setIsEditing(false);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { detail?: string } } };
      const detail = apiError?.response?.data?.detail ?? "";
      if (detail.includes("parcelas pagas")) {
        setSubmitError(
          "Esta venda possui parcelas pagas e não pode ter seus itens alterados"
        );
      } else if (detail) {
        setSubmitError(detail);
      } else {
        setSubmitError("Erro ao salvar venda. Tente novamente.");
      }
    }
  }

  async function handleDelete() {
    try {
      await deleteSale.mutateAsync(saleId);
      router.push("/vendas");
    } catch {
      setConfirmDelete(false);
    }
  }

  const itemsError = errors.items as { message?: string } | undefined;
  const installmentsError = errors.installments as
    | { message?: string }
    | undefined;

  // ── Loading / not found ───────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-sm text-gray-500">
        Venda não encontrada.{" "}
        <Link href="/vendas" className="text-blue-600 hover:underline">
          Voltar para vendas
        </Link>
      </div>
    );
  }

  const isGerente = user?.role === ROLES.GERENTE;
  const hasPaidInstallments = sale.installments.some((i) => i.paid_amount > 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-14 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/vendas"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                Vendas
              </Link>
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span
                  className={cn(
                    "text-xs font-semibold px-1.5 py-0.5 rounded shrink-0",
                    sale.payment_mode === "FIADO"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-blue-100 text-blue-700"
                  )}
                >
                  {sale.payment_mode === "FIADO" ? "Fiado" : "À vista"}
                </span>
                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium shrink-0">
                  {sale.sale_type === "LOJA" ? "Loja" : "Rota"}
                </span>
                <span className="text-sm font-bold text-gray-900 truncate">
                  {sale.client_name}
                </span>
              </div>
            </div>
            <span className="shrink-0 text-lg font-bold text-blue-700 tabular-nums ml-3">
              {formatCurrency(sale.amount)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(sale.sale_date)} · {sale.seller_name}
          </p>
        </div>
      </div>

      {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-32 space-y-3">

        {/* ══ MODO VISUALIZAÇÃO ════════════════════════════════════════════ */}
        {!isEditing && (
          <>
            {/* Produtos (read-only) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Produtos
                </span>
                <span className="text-xs text-gray-400 ml-1">
                  ({sale.items.length})
                </span>
              </div>
              {sale.items.length === 0 ? (
                <p className="px-3 py-6 text-sm text-gray-400 text-center">
                  Nenhum produto
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_48px_72px_72px] gap-x-2 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                    <span>Produto</span>
                    <span className="text-center">Qtd</span>
                    <span className="text-right">Preço</span>
                    <span className="text-right">Total</span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {sale.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[1fr_48px_72px_72px] gap-x-2 items-center px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.product_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {item.unit_measure}
                          </p>
                        </div>
                        <span className="text-xs text-gray-600 text-center tabular-nums">
                          {item.quantity}
                        </span>
                        <span className="text-xs text-gray-600 text-right tabular-nums">
                          {formatCurrency(item.unit_price)}
                        </span>
                        <span className="text-xs font-semibold text-gray-700 text-right tabular-nums">
                          {formatCurrency(item.subtotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Totais (read-only) */}
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
                    {formatCurrency(sale.subtotal)}
                  </span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Desconto</span>
                    <span className="tabular-nums text-orange-600 font-medium">
                      − {formatCurrency(sale.discount)}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-800">Total</span>
                  <span className="text-xl font-bold tabular-nums text-blue-700">
                    {formatCurrency(sale.amount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pagamento (read-only) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
                <Wallet className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Pagamento
                </span>
              </div>
              <div className="px-3 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  {sale.payment_mode === "A_VISTA" ? (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                      <Banknote className="w-4 h-4" />À vista
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                      <CalendarDays className="w-4 h-4" />
                      Fiado
                    </span>
                  )}
                </div>

                {sale.payment_mode === "FIADO" && sale.installments.length > 0 && (
                  <div className="space-y-1.5 mt-1">
                    <div className="grid grid-cols-[20px_1fr_80px_70px_64px] gap-x-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-0.5">
                      <span>#</span>
                      <span>Vencimento</span>
                      <span className="text-right">Valor</span>
                      <span className="text-right">Pago</span>
                      <span className="text-right">Status</span>
                    </div>
                    {sale.installments.map((inst) => (
                      <div
                        key={inst.id}
                        className="grid grid-cols-[20px_1fr_80px_70px_64px] gap-x-2 items-center"
                      >
                        <span className="text-[10px] font-bold text-gray-400 text-center">
                          {inst.number}
                        </span>
                        <span className="text-xs text-gray-700">
                          {formatDate(inst.due_date)}
                        </span>
                        <span className="text-xs text-right tabular-nums text-gray-700">
                          {formatCurrency(inst.amount)}
                        </span>
                        <span className="text-xs text-right tabular-nums text-gray-500">
                          {formatCurrency(inst.paid_amount)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded text-right",
                            INSTALLMENT_STATUS_CLASS[inst.status] ??
                              "bg-gray-100 text-gray-500"
                          )}
                        >
                          {INSTALLMENT_STATUS_LABEL[inst.status] ?? inst.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Observação (read-only) */}
            {sale.description && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border-b border-gray-200">
                  <FileText className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Observação
                  </span>
                </div>
                <p className="px-3 py-2 text-sm text-gray-700">
                  {sale.description}
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleEdit}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
                Editar venda
              </button>

              <Link
                href={`/clientes/${sale.client_id}`}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Ver extrato do cliente →
              </Link>

              {isGerente && (
                <div className="mt-1">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir venda
                    </button>
                  ) : (
                    <div className="border border-red-200 rounded-xl p-3 bg-red-50 space-y-2">
                      <p className="text-sm text-red-700 font-medium text-center">
                        Confirmar exclusão desta venda?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleteSale.isPending}
                          className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                        >
                          {deleteSale.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Excluir
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ MODO EDIÇÃO ══════════════════════════════════════════════════ */}
        {isEditing && (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
            {hasPaidInstallments && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Esta venda tem parcelas pagas. Não é possível alterar itens ou
                  desconto.
                </span>
              </div>
            )}

            {/* ProductPicker */}
            {!hasPaidInstallments && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Adicionar produto
                  </span>
                </div>
                <div className="p-3">
                  <ProductPicker
                    onSelect={handleProductSelect}
                    gridMaxHeight="220px"
                  />
                </div>
              </div>
            )}

            {/* Carrinho editável */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-1.5">
                  <ShoppingCart className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Produtos
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
                      const readOnly = hasPaidInstallments;

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
                              {!readOnly && (
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
                              )}
                              <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                inputMode="decimal"
                                aria-label="Quantidade"
                                readOnly={readOnly}
                                className={cn(
                                  "border border-gray-300 rounded px-0.5 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500",
                                  readOnly
                                    ? "w-16 bg-gray-50 text-gray-500"
                                    : "w-8"
                                )}
                                {...register(`items.${index}.quantity`, {
                                  valueAsNumber: true,
                                })}
                              />
                              {!readOnly && (
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
                              )}
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
                              readOnly={readOnly}
                              className={cn(
                                "w-full border border-gray-300 rounded-lg px-1.5 py-1.5 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500",
                                readOnly && "bg-gray-50 text-gray-500"
                              )}
                              {...register(`items.${index}.unit_price`, {
                                valueAsNumber: true,
                              })}
                            />

                            <span className="text-xs font-semibold text-gray-700 text-right tabular-nums">
                              {formatCurrency(itemSubtotal)}
                            </span>

                            {!readOnly ? (
                              <button
                                type="button"
                                onClick={() => removeItem(index)}
                                aria-label="Remover item"
                                className="flex items-center justify-center w-5 h-5 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors mx-auto"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            ) : (
                              <span />
                            )}
                          </div>

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
                      readOnly={hasPaidInstallments}
                      className={cn(
                        "w-24 border border-gray-300 rounded-lg px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500",
                        hasPaidInstallments && "bg-gray-50 text-gray-500"
                      )}
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

            {/* Erro */}
            {submitError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateSale.isPending}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {updateSale.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
