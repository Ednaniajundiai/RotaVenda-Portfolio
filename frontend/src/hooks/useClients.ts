import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import {
  Client,
  ClientBalance,
  ClientCreate,
  ClientStatement,
  ClientStreetCreate,
  ClientUpdate,
  StreetInClient,
} from "@/types/client";
import { Street } from "@/types/street";

export interface UseClientsParams {
  search?: string;
  page?: number;
  limit?: number;
  filter?: "com_debito" | "quitados" | "todos";
  neighborhood?: string;
  street_id?: string;
  sort?: "nome" | "saldo_desc" | "saldo_asc" | "recente";
  include_inactive?: boolean;
}

export function useClients(params: UseClientsParams = {}) {
  const {
    search,
    page = 0,
    limit = 20,
    filter,
    neighborhood,
    street_id,
    sort,
    include_inactive,
  } = params;
  return useQuery({
    queryKey: [
      ...QUERY_KEYS.CLIENTS,
      {
        search: search ?? "",
        page,
        limit,
        filter: filter ?? "todos",
        neighborhood: neighborhood ?? "",
        street_id: street_id ?? "",
        sort: sort ?? "nome",
        include_inactive: include_inactive ?? false,
      },
    ],
    queryFn: async () => {
      const res = await api.get<Client[]>("/clients", {
        params: {
          search: search || undefined,
          skip: page * limit,
          limit,
          saldo_filter: filter && filter !== "todos" ? filter : undefined,
          neighborhood: neighborhood || undefined,
          street_id: street_id || undefined,
          sort: sort && sort !== "nome" ? sort : undefined,
          include_inactive: include_inactive || undefined,
        },
      });
      const total = parseInt(res.headers["x-total-count"] ?? "0", 10);
      const totalSaldo = parseFloat(res.headers["x-total-saldo"] ?? "0");
      return { items: res.data, total, totalSaldo };
    },
  });
}

export function useClientNeighborhoods() {
  return useQuery({
    queryKey: QUERY_KEYS.CLIENT_NEIGHBORHOODS,
    queryFn: async () => {
      const { data } = await api.get<string[]>("/clients/neighborhoods");
      return data;
    },
  });
}

export function useClientStreetsFilter(neighborhood?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CLIENT_STREETS_FILTER(neighborhood ?? ""),
    queryFn: async () => {
      const { data } = await api.get<Street[]>("/clients/streets", {
        params: { neighborhood: neighborhood || undefined },
      });
      return data;
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CLIENT(id),
    queryFn: async () => {
      const { data } = await api.get<Client>(`/clients/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useClientBalance(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CLIENT_BALANCE(id),
    queryFn: async () => {
      const { data } = await api.get<ClientBalance>(`/clients/${id}/balance`);
      return data;
    },
    enabled: !!id,
  });
}

export function useClientStreets(clientId: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CLIENT(clientId), "streets"],
    queryFn: async () => {
      const { data } = await api.get<StreetInClient[]>(
        `/clients/${clientId}/streets`
      );
      return data;
    },
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientCreate) =>
      api.post<Client>("/clients", body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENTS }),
  });
}

export function useUpdateClient(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientUpdate) =>
      api.put<Client>(`/clients/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENT(id) });
    },
  });
}

export function useDeactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<Client>(`/clients/${id}`).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CLIENTS }),
  });
}

export function useAddClientToStreet(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ClientStreetCreate) =>
      api
        .post<StreetInClient>(`/clients/${clientId}/streets`, body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.CLIENT(clientId), "streets"],
      });
    },
  });
}

export function useClientStatement(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CLIENT_STATEMENT(id),
    queryFn: async () => {
      const { data } = await api.get<ClientStatement>(
        `/clients/${id}/statement`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useRemoveClientFromStreet(clientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (streetId: string) =>
      api.delete(`/clients/${clientId}/streets/${streetId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.CLIENT(clientId), "streets"],
      });
    },
  });
}
