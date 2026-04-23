"use client";

import Link from "next/link";
import { useState } from "react";
import { Package, Plus, Search } from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { useDeleteProduct, useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import { StockStatus } from "@/types/product";

const STOCK_BADGE: Record<StockStatus, { label: string; className: string }> = {
  OK: { label: "OK", className: "bg-green-100 text-green-700" },
  LOW: { label: "Baixo", className: "bg-yellow-100 text-yellow-700" },
  OUT: { label: "Zerado", className: "bg-red-100 text-red-700" },
};

export default function ProdutosPage() {
  const { user } = useAuth();
  const isGerente = user?.role === "GERENTE";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [category, setCategory] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  const { data: products, isLoading } = useProducts({
    search: debouncedSearch || undefined,
    category: category || undefined,
    include_inactive: includeInactive,
  });

  const deleteProduct = useDeleteProduct();

  const categories = Array.from(
    new Set(products?.map((p) => p.category) ?? [])
  ).sort();

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          <h1 className="text-lg font-semibold text-gray-800">Produtos</h1>
        </div>
        {isGerente && (
          <Link
            href="/produtos/novo"
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo
          </Link>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {isGerente && (
            <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="rounded"
              />
              Incluir inativos
            </label>
          )}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 space-y-2">
        {isLoading && (
          <p className="text-sm text-gray-400 text-center py-8">
            Carregando...
          </p>
        )}
        {!isLoading && products?.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            Nenhum produto encontrado
          </p>
        )}
        {products?.map((product) => {
          const badge = STOCK_BADGE[product.stock_status];
          return (
            <div
              key={product.id}
              className={cn(
                "bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3",
                !product.is_active && "opacity-60"
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-800 truncate">
                    {product.name}
                  </span>
                  {!product.is_active && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      Inativo
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-gray-500">
                    {product.category}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs text-gray-500">
                    {product.unit_measure}
                  </span>
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-xs font-semibold text-gray-700">
                    R$ {product.price.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded font-medium",
                      badge.className
                    )}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    Estoque: {product.current_stock} / Mín: {product.min_stock}
                  </span>
                </div>
              </div>
              {isGerente && (
                <Link
                  href={`/produtos/${product.id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium shrink-0"
                >
                  Editar
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
