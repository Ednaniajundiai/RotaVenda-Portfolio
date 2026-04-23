import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import { Payment, PaymentCreate, PaymentUpdate } from "@/types/payment";

interface PaymentFilters {
  client_id?: string;
  route_street_id?: string;
  payment_date?: string;
}

export function usePayments(filters?: PaymentFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.PAYMENTS, filters ?? {}],
    queryFn: async () => {
      const { data } = await api.get<Payment[]>("/payments", {
        params: filters,
      });
      return data;
    },
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PaymentCreate) =>
      api.post<Payment>("/payments", body).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SALES }); // cobre installments
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_BALANCE(data.client_id),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_STATEMENT(data.client_id),
      });
      if (data.route_street_id) {
        queryClient.invalidateQueries({ queryKey: ["routes"] });
      }
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PaymentUpdate }) =>
      api.put<Payment>(`/payments/${id}`, data).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_BALANCE(data.client_id),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.CLIENT_STATEMENT(data.client_id),
      });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PAYMENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENTS });
    },
  });
}
