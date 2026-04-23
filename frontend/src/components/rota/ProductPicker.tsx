"use client";

import { useState } from "react";
import { Package, Search } from "lucide-react";

import { useDebounce } from "@/hooks/useDebounce";
import { useProducts } from "@/hooks/useProducts";
import { cn, formatCurrency } from "@/lib/utils";
import { Product } from "@/types/product";

interface ProductPickerProps {
  onSelect: (product: Product) => void;
  gridMaxHeight?: string;
  className?: string;
}

const stockConfig = {
  OK: { label: "Em estoque", className: "bg-green-100 text-green-700" },
  LOW: { label: "Estoque baixo", className: "bg-yellow-100 text-yellow-700" },
  OUT: { label: "Sem estoque", className: "bg-gray-100 text-gray-500" },
};

export function ProductPicker({
  onSelect,
  gridMaxHeight = "280px",
  className,
}: ProductPickerProps) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data: products, isLoading } = useProducts({
    search: debouncedQuery || undefined,
    limit: 500,
  });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Input de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar produto..."
          className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Grade de produtos */}
      <div className="overflow-y-auto" style={{ maxHeight: gridMaxHeight }}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
            Carregando produtos...
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {products.map((product) => {
              const { label, className: badgeClass } =
                stockConfig[product.stock_status];
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => onSelect(product)}
                  title={`Adicionar ${product.name}`}
                  className="flex flex-col gap-1.5 p-3 rounded-xl border border-gray-200 bg-white text-left transition-all hover:border-blue-400 hover:bg-blue-50 active:scale-[0.97] cursor-pointer"
                >
                  <span className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
                    {product.name}
                  </span>
                  <span className="text-xs text-gray-400">{product.unit_measure}</span>
                  <span className="text-base font-bold text-blue-700 tabular-nums">
                    {formatCurrency(product.price)}
                  </span>
                  <span
                    className={cn(
                      "text-xs rounded-full px-2 py-0.5 w-fit font-medium",
                      badgeClass
                    )}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
            <Package className="w-8 h-8" />
            <span className="text-sm">
              {query ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
