import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import {
  Route,
  RouteCreate,
  RouteStreetCreate,
  RouteStreetDetail,
  RouteStreetSummary,
  RouteUpdate,
} from "@/types/route";

interface RouteFilters {
  route_date?: string;
  status?: string;
  archived?: boolean;
}

export function useRoutes(filters?: RouteFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ROUTES, filters ?? {}],
    queryFn: async () => {
      const { data } = await api.get<Route[]>("/routes", { params: filters });
      return data;
    },
  });
}

export function useRoute(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ROUTE(id),
    queryFn: async () => {
      const { data } = await api.get<Route>(`/routes/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useRouteStreets(routeId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
    queryFn: async () => {
      const { data } = await api.get<RouteStreetSummary[]>(
        `/routes/${routeId}/streets`
      );
      return data;
    },
    enabled: !!routeId,
  });
}

export function useRouteStreetDetail(routeId: string, rsId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ROUTE_STREET(routeId, rsId),
    queryFn: async () => {
      const { data } = await api.get<RouteStreetDetail>(
        `/routes/${routeId}/streets/${rsId}`
      );
      return data;
    },
    enabled: !!routeId && !!rsId,
  });
}

export function useCreateRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteCreate) =>
      api.post<Route>("/routes", body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES }),
  });
}

export function useUpdateRoute(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteUpdate) =>
      api.put<Route>(`/routes/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(id) });
    },
  });
}

export function useDeleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/routes/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES }),
  });
}

export function useStartRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Route>(`/routes/${id}/start`).then((r) => r.data),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(id) });
    },
  });
}

export function useCompleteRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<Route>(`/routes/${id}/complete`).then((r) => r.data),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(id) });
    },
  });
}

export function useAddRouteStreet(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteStreetCreate) =>
      api
        .post<RouteStreetSummary>(`/routes/${routeId}/streets`, body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
    },
  });
}

export function useRemoveRouteStreet(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rsId: string) =>
      api.delete(`/routes/${routeId}/streets/${rsId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
    },
  });
}

export function useReorderRouteStreets(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; visit_order: number }[]) =>
      api
        .patch<RouteStreetSummary[]>(
          `/routes/${routeId}/streets/reorder`,
          { items }
        )
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
    },
  });
}

export function useStartRouteStreet(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rsId: string) =>
      api
        .post<RouteStreetSummary>(`/routes/${routeId}/streets/${rsId}/start`)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
    },
  });
}

export function useCompleteRouteStreet(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rsId: string) =>
      api
        .post<RouteStreetSummary>(
          `/routes/${routeId}/streets/${rsId}/complete`
        )
        .then((r) => r.data),
    onSuccess: (_, rsId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREET(routeId, rsId),
      });
    },
  });
}

export function useSkipRouteStreet(routeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rsId: string) =>
      api
        .post<RouteStreetSummary>(`/routes/${routeId}/streets/${rsId}/skip`)
        .then((r) => r.data),
    onSuccess: (_, rsId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE(routeId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREETS(routeId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_STREET(routeId, rsId),
      });
    },
  });
}

export function useArchiveRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) =>
      api.post<Route>(`/routes/${routeId}/archive`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
    },
  });
}

export function useUnarchiveRoute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (routeId: string) =>
      api.post<Route>(`/routes/${routeId}/unarchive`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTES });
    },
  });
}
