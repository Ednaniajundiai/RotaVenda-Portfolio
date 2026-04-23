import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import {
  RouteTemplate,
  RouteTemplateCreate,
  RouteTemplateStreetAdd,
  RouteTemplateStreetReorderItem,
  RouteTemplateUpdate,
} from "@/types/routeTemplate";

export function useRouteTemplates(onlyActive = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.ROUTE_TEMPLATES, { onlyActive }],
    queryFn: async () => {
      const { data } = await api.get<RouteTemplate[]>("/route-templates", {
        params: { only_active: onlyActive },
      });
      return data;
    },
  });
}

export function useRouteTemplate(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.ROUTE_TEMPLATE(id),
    queryFn: async () => {
      const { data } = await api.get<RouteTemplate>(`/route-templates/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateRouteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteTemplateCreate) =>
      api.post<RouteTemplate>("/route-templates", body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES }),
  });
}

export function useUpdateRouteTemplate(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteTemplateUpdate) =>
      api
        .patch<RouteTemplate>(`/route-templates/${id}`, body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_TEMPLATE(id),
      });
    },
  });
}

export function useDeleteRouteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/route-templates/${id}`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES }),
  });
}

export function useAddStreetToTemplate(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RouteTemplateStreetAdd) =>
      api
        .post<RouteTemplate>(`/route-templates/${templateId}/streets`, body)
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_TEMPLATE(templateId),
      });
    },
  });
}

export function useRemoveStreetFromTemplate(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (rtsId: string) =>
      api
        .delete<RouteTemplate>(
          `/route-templates/${templateId}/streets/${rtsId}`
        )
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_TEMPLATE(templateId),
      });
    },
  });
}

export function useReorderTemplateStreets(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: RouteTemplateStreetReorderItem[]) =>
      api
        .put<RouteTemplate>(
          `/route-templates/${templateId}/streets/reorder`,
          { items }
        )
        .then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ROUTE_TEMPLATES });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.ROUTE_TEMPLATE(templateId),
      });
    },
  });
}
