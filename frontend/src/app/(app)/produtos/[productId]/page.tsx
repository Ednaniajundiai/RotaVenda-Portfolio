"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Trash2 } from "lucide-react";

import { useProduct, useUpdateProduct, useDeleteProduct } from "@/hooks/useProducts";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Informe o nome"),
  category: z.string().min(1, "Informe a categoria"),
  unit_measure: z.string().min(1, "Informe a unidade de medida"),
  price: z
    .number({ invalid_type_error: "Informe o preço" })
    .positive("Preço deve ser maior que zero"),
  current_stock: z.number().int().min(0, "Estoque não pode ser negativo"),
  min_stock: z.number().int().min(0, "Estoque mínimo não pode ser negativo"),
  is_active: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function EditarProdutoPage() {
  const { productId } = useParams<{ productId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const { data: product, isLoading } = useProduct(productId);
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        category: product.category,
        unit_measure: product.unit_measure,
        price: product.price,
        current_stock: product.current_stock,
        min_stock: product.min_stock,
        is_active: product.is_active,
      });
    }
  }, [product, reset]);

  const onSubmit = (values: FormValues) => {
    updateProduct.mutate(
      { id: productId, data: values },
      { onSuccess: () => router.push("/produtos") }
    );
  };

  const handleDeactivate = () => {
    if (!confirm("Desativar este produto?")) return;
    deleteProduct.mutate(productId, {
      onSuccess: () => router.push("/produtos"),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Produto não encontrado</p>
      </div>
    );
  }

  const STOCK_COLOR = {
    OK: "text-green-600",
    LOW: "text-yellow-600",
    OUT: "text-red-600",
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800">
            {isGerente ? "Editar produto" : "Produto"}
          </h1>
        </div>
        {isGerente && product.is_active && (
          <button
            onClick={handleDeactivate}
            className="text-red-500 hover:text-red-700"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Status de estoque */}
      <div className="px-4 pt-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Estoque atual</p>
            <p
              className={cn(
                "text-2xl font-bold",
                STOCK_COLOR[product.stock_status]
              )}
            >
              {product.current_stock}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Mínimo</p>
            <p className="text-lg font-semibold text-gray-700">
              {product.min_stock}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome
          </label>
          <input
            type="text"
            disabled={!isGerente}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
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
            disabled={!isGerente}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            {...register("category")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unidade de medida
          </label>
          <input
            type="text"
            disabled={!isGerente}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            {...register("unit_measure")}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preço (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            disabled={!isGerente}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            {...register("price", { valueAsNumber: true })}
          />
          {errors.price && (
            <p className="text-red-500 text-xs mt-0.5">
              {errors.price.message}
            </p>
          )}
        </div>

        {isGerente && (
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
        )}

        {isGerente && (
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              className="rounded"
              {...register("is_active")}
            />
            Produto ativo
          </label>
        )}

        {updateProduct.error && (
          <p className="text-red-500 text-sm">
            Erro ao salvar. Verifique se já existe produto com mesmo nome e
            unidade.
          </p>
        )}

        {isGerente && (
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
              disabled={updateProduct.isPending || !isDirty}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateProduct.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
