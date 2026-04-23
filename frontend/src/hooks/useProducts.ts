import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { Product, ProductCreate, ProductUpdate } from "@/types/product";

interface ProductFilters {
  search?: string;
  category?: string;
  include_inactive?: boolean;
  skip?: number;
  limit?: number;
}

export function useProducts(filters?: ProductFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PRODUCTS, filters ?? {}],
    queryFn: async () => {
      const { data } = await api.get<Product[]>("/products", {
        params: filters,
      });
      return data;
    },
  });
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.PRODUCT(id ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Product>(`/products/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ProductCreate) =>
      api.post<Product>("/products", body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdate }) =>
      api.put<Product>(`/products/${id}`, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(data.id) });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS });
    },
  });
}
