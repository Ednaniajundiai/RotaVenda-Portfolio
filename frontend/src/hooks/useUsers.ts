import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";
import {
  UserAdmin,
  UserCreate,
  UserPasswordUpdate,
  UserUpdate,
} from "@/types/user";

export function useUsers(includeInactive = false) {
  return useQuery({
    queryKey: [...QUERY_KEYS.USERS, includeInactive],
    queryFn: async () => {
      const { data } = await api.get<UserAdmin[]>("/users", {
        params: { include_inactive: includeInactive },
      });
      return data;
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) =>
      api.post<UserAdmin>("/users", body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
  });
}

export function useUpdateUser(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UserUpdate) =>
      api.put<UserAdmin>(`/users/${id}`, body).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
  });
}

export function useUpdateUserPassword(id: string) {
  return useMutation({
    mutationFn: (body: UserPasswordUpdate) =>
      api.patch<UserAdmin>(`/users/${id}/password`, body).then((r) => r.data),
  });
}

export function useDeactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<UserAdmin>(`/users/${id}`).then((r) => r.data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.USERS }),
  });
}
