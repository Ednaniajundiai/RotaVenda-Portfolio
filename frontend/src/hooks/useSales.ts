import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import api from "@/lib/api";
import { extractApiMessage } from "@/lib/errors";
import { QUERY_KEYS } from "@/lib/constants";
import { Installment, Sale, SaleCreate, SaleUpdate } from "@/types/sale";

interface SaleFilters {
  client_id?: string;
  route_street_id?: string;
  sale_date?: string;
}

export function useSales(filters?: SaleFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.SALES, filters ?? {}],
    queryFn: async () => {
      const { data } = await api.get<Sale[]>("/sales", { params: filters });
      return data;
    },
  });
}

export function useSale(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.SALE(id),
    queryFn: async () => {
      const { data } = await api.get<Sale>(`/sales/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SaleCreate) =>
      api.post<Sale>("/sales", body).then((r) => r.data),
    onSuccess: (data) => {
      toast.success("Venda registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SALES });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_BALANCE(data.client_id),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_STATEMENT(data.client_id),
      });
      // Fix 2.5: invalidação fina — apenas a rua específica, não toda a key "routes"
      if (data.route_street_id) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.ROUTE_STREET(
            // route_id não está no payload, então invalidamos pelo route_street_id
            // usando a key mais ampla de ROUTE_STREETS ainda — a próxima etapa
            // será passar route_id no payload de retorno da API.
            "*",
            data.route_street_id
          ),
        });
        // Fallback conservador: ainda invalida rotas se a key acima não cobrir
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
      }
    },
    onError: (err) => {
      toast.error(extractApiMessage(err));
    },
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SaleUpdate }) =>
      api.put<Sale>(`/sales/${id}`, data).then((r) => r.data),
    onSuccess: (data) => {
      toast.success("Venda atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SALES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SALE(data.id) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_BALANCE(data.client_id),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_STATEMENT(data.client_id),
      });
    },
    onError: (err) => {
      toast.error(extractApiMessage(err));
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/sales/${id}`),
    onSuccess: () => {
      toast.success("Venda estornada com sucesso!");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SALES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENTS });
    },
    onError: (err) => {
      toast.error(extractApiMessage(err));
    },
  });
}

export function useSaleInstallments(saleId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.SALE_INSTALLMENTS(saleId ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Installment[]>(
        `/sales/${saleId}/installments`
      );
      return data;
    },
    enabled: !!saleId,
  });
}
