import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import {
  ClientInStreet,
  ReorderItem,
  Street,
  StreetCreate,
  StreetUpdate,
} from "@/types/street";

export function useStreets(search?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STREETS, search ?? ""],
    queryFn: async () => {
      const params = search ? { search } : {};
      const { data } = await api.get<Street[]>("/streets", { params });
      return data;
    },
  });
}

export function useStreet(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.STREET(id),
    queryFn: async () => {
      const { data } = await api.get<Street>(`/streets/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useStreetClients(streetId: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.STREET(streetId), "clients"],
    queryFn: async () => {
      const { data } = await api.get<ClientInStreet[]>(
        `/streets/${streetId}/clients`
      );
      return data;
    },
    enabled: !!streetId,
  });
}

export function useCreateStreet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StreetCreate) =>
      api.post<Street>("/streets", body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREETS }),
  });
}

export function useUpdateStreet(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: StreetUpdate) =>
      api.put<Street>(`/streets/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREETS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREET(id) });
    },
  });
}

export function useDeactivateStreet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<Street>(`/streets/${id}`).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STREETS }),
  });
}

export function useReorderStreetClients(streetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderItem[]) =>
      api
        .patch<ClientInStreet[]>(`/streets/${streetId}/clients/reorder`, {
          items,
        })
        .then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.STREET(streetId), "clients"],
      }),
  });
}
