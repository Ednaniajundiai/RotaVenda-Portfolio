"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";

import { useCreateProduct } from "@/hooks/useProducts";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  category: z.string().min(1, "Informe a categoria"),
  unit_measure: z.string().min(1, "Informe a unidade de medida"),
  price: z
    .number({ invalid_type_error: "Informe o preço" })
    .positive("Preço deve ser maior que zero"),
  current_stock: z.number().int().min(0, "Estoque não pode ser negativo").default(0),
  min_stock: z.number().int().min(0, "Estoque mínimo não pode ser negativo").default(0),
});

type FormValues = z.infer<typeof schema>;

export default function NovoProdutoPage() {
  const router = useRouter();
  const createProduct = useCreateProduct();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { current_stock: 0, min_stock: 0 },
  });

  const onSubmit = (values: FormValues) => {
    createProduct.mutate(values, {
      onSuccess: () => router.push("/produtos"),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-gray-800">Novo produto</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Sabão em Pó 1kg"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-red-500 text-xs mt-0.5">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categoria
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Utilidades ou Produto"
            {...register("category")}
          />
          {errors.category && (
            <p className="text-red-500 text-xs mt-0.5">
              {errors.category.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unidade de medida
          </label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ex: Unidade, Caixa, Fardo, Dúzia"
            {...register("unit_measure")}
          />
          {errors.unit_measure && (
            <p className="text-red-500 text-xs mt-0.5">
              {errors.unit_measure.message}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preço (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="0,00"
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price && (
            <p className="text-red-500 text-xs mt-0.5">
              {errors.price.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estoque atual
            </label>
            <input
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register("current_stock", { valueAsNumber: true })}
            />
            {errors.current_stock && (
              <p className="text-red-500 text-xs mt-0.5">
                {errors.current_stock.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Estoque mínimo
            </label>
            <input
              type="number"
              min="0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              {...register("min_stock", { valueAsNumber: true })}
            />
            {errors.min_stock && (
              <p className="text-red-500 text-xs mt-0.5">
                {errors.min_stock.message}
              </p>
            )}
          </div>
        </div>

        {createProduct.error && (
          <p className="text-red-500 text-sm">
            Erro ao criar produto. Verifique se já existe um produto com esse
            nome e unidade.
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={createProduct.isPending}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {createProduct.isPending ? "Salvando..." : "Criar produto"}
          </button>
        </div>
      </form>
    </div>
  );
}
