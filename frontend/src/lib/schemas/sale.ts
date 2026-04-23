/**
 * Schemas Zod compartilhados para formulários de venda.
 *
 * Centraliza `installmentSchema`, `saleItemSchema` e `saleFormSchema`
 * para serem consumidos em:
 *   - frontend/src/components/rota/SaleForm.tsx
 *   - frontend/src/app/(app)/vendas/nova/page.tsx
 *   - frontend/src/app/(app)/vendas/[saleId]/page.tsx
 *
 * Fix 2.1 do PLANO_QA.md: eliminar duplicação de schemas Zod.
 */

import { z } from "zod";

import { formatCurrency } from "@/lib/utils";

// ── Sub-schemas ─────────────────────────────────────────────────────────────

export const installmentSchema = z.object({
  number: z.number().int().positive(),
  due_date: z.string().min(1, "Informe a data"),
  amount: z
    .number({ invalid_type_error: "Informe o valor" })
    .positive("Valor deve ser maior que zero"),
});

export const saleItemSchema = z.object({
  product_id: z.string().uuid("Selecione um produto"),
  product_name: z.string().min(1),
  unit_measure: z.string(),
  quantity: z
    .number({ invalid_type_error: "Informe a quantidade" })
    .positive("Quantidade deve ser maior que zero"),
  unit_price: z
    .number({ invalid_type_error: "Informe o preço" })
    .positive("Preço deve ser maior que zero"),
  /** Estoque disponível no momento da adição (somente frontend). */
  stockAvailable: z.number().optional(),
});

// ── Schema principal ─────────────────────────────────────────────────────────

export const saleFormSchema = z
  .object({
    items: z.array(saleItemSchema).min(1, "Adicione pelo menos um produto"),
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

    // Valida desconto
    if (discount > 0 && discount >= subtotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Desconto deve ser menor que o subtotal",
        path: ["discount"],
      });
    }

    // Fix 2.9: bloquear submit quando quantity > stockAvailable
    data.items.forEach((item, index) => {
      if (
        item.stockAvailable !== undefined &&
        item.quantity > item.stockAvailable
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Quantidade (${item.quantity}) excede estoque disponível (${item.stockAvailable} ${item.unit_measure || "un"})`,
          path: ["items", index, "quantity"],
        });
      }
    });

    // Valida soma de parcelas
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

export type SaleFormValues = z.infer<typeof saleFormSchema>;

/** Helper para data de vencimento de parcela a partir de hoje + N meses */
export function dueDateFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}
