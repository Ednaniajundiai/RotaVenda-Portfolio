"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { InstallmentApplicationInput, PaymentCreate } from "@/types/payment";
import { Installment } from "@/types/sale";

export interface PendingInstallment extends Installment {
  sale_description: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PARTIAL: "Parcial",
  OVERDUE: "Vencida",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PARTIAL: "bg-yellow-100 text-yellow-700",
  OVERDUE: "bg-red-100 text-red-700",
};

function buildSchema(pendingCount: number) {
  return z
    .object({
      amount: z
        .number({ invalid_type_error: "Informe o valor" })
        .positive("Valor deve ser maior que zero"),
      notes: z.string().optional(),
      applications: z.array(
        z.object({
          installment_id: z.string(),
          amount: z.number().min(0),
        })
      ),
    })
    .superRefine((data, ctx) => {
      const totalApplied = data.applications.reduce(
        (s, a) => s + (a.amount || 0),
        0
      );
      if (pendingCount > 0 && totalApplied > 0) {
        if (Math.abs(totalApplied - data.amount) > 0.01) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Soma das aplicações (${totalApplied.toFixed(2)}) deve igualar o valor pago (${data.amount.toFixed(2)})`,
            path: ["applications"],
          });
        }
      }
    });
}

interface PaymentFormProps {
  clientId: string;
  routeStreetId?: string;
  pendingInstallments?: PendingInstallment[];
  onSubmit: (data: PaymentCreate) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function PaymentForm({
  clientId,
  routeStreetId,
  pendingInstallments = [],
  onSubmit,
  onCancel,
  isLoading,
}: PaymentFormProps) {
  const schema = buildSchema(pendingInstallments.length);
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      applications: pendingInstallments.map((i) => ({
        installment_id: i.id,
        amount: 0,
      })),
    },
  });

  const handleFormSubmit = (values: FormValues) => {
    const filteredApps: InstallmentApplicationInput[] = values.applications
      .filter((a) => a.amount > 0)
      .map((a) => ({ installment_id: a.installment_id, amount: a.amount }));

    onSubmit({
      client_id: clientId,
      route_street_id: routeStreetId,
      amount: values.amount,
      notes: values.notes || undefined,
      installment_applications:
        filteredApps.length > 0 ? filteredApps : undefined,
    });
  };

  const applicationsError = errors.applications as
    | { message?: string }
    | undefined;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Valor Recebido (R$)
        </label>
        <input
          type="text"
          inputMode="decimal"
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="0,00"
          {...register("amount", {
            valueAsNumber: true,
            setValueAs: (v) => {
              const parsed = parseFloat(String(v).replace(",", "."));
              return isNaN(parsed) ? NaN : parsed;
            },
          })}
        />
        {errors.amount && (
          <p className="text-red-500 text-xs mt-0.5">{errors.amount.message}</p>
        )}
      </div>

      {pendingInstallments.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Alocar nas parcelas (opcional — FIFO automático se deixar vazio)
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {pendingInstallments.map((inst, index) => (
              <div
                key={inst.id}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLOR[inst.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABEL[inst.status] ?? inst.status}
                    </span>
                    <span className="text-xs text-gray-500 truncate">
                      {inst.sale_description ?? "Venda"} — parc. {inst.number}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Venc.{" "}
                    {new Date(inst.due_date + "T00:00:00").toLocaleDateString(
                      "pt-BR"
                    )}{" "}
                    · Saldo R${" "}
                    {inst.remaining.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  className="w-24 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  {...register(`applications.${index}.amount`, {
                    setValueAs: (v) => parseFloat(String(v).replace(",", ".")) || 0,
                  })}
                />
              </div>
            ))}
          </div>
          {applicationsError?.message && (
            <p className="text-red-500 text-xs mt-1">
              {applicationsError.message}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Observação (opcional)
        </label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Ex: Pagou parte da dívida"
          {...register("notes")}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="flex-[2] py-3.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
        >
          {isLoading ? "Salvando..." : "Registrar pagamento"}
        </button>
      </div>
    </form>
  );
}
