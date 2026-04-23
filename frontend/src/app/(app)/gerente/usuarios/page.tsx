"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import {
  useCreateUser,
  useDeactivateUser,
  useUpdateUser,
  useUpdateUserPassword,
  useUsers,
} from "@/hooks/useUsers";
import { formatDate } from "@/lib/utils";
import { UserAdmin } from "@/types/user";

type Modal =
  | { type: "create" }
  | { type: "edit"; user: UserAdmin }
  | { type: "password"; user: UserAdmin }
  | null;

export default function UsuariosPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role !== "GERENTE") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  const [includeInactive, setIncludeInactive] = useState(false);
  const { data: users, isLoading } = useUsers(includeInactive);
  const createUser = useCreateUser();
  const deactivateUser = useDeactivateUser();

  const [modal, setModal] = useState<Modal>(null);

  if (!currentUser || currentUser.role !== "GERENTE") return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users?.length ?? 0} usuário(s)
          </p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + Novo usuário
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="includeInactive"
          checked={includeInactive}
          onChange={(e) => setIncludeInactive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="includeInactive" className="text-sm text-gray-600">
          Mostrar inativos
        </label>
      </div>

      {isLoading ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Carregando...
        </div>
      ) : !users || users.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          Nenhum usuário encontrado
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Nome
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">
                  Email
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Perfil
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.name}
                    {u.id === currentUser.id && (
                      <span className="ml-2 text-xs text-blue-600">(você)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.role === "GERENTE"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role === "GERENTE" ? "Gerente" : "Vendedor"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.is_active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.id !== currentUser.id && (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setModal({ type: "edit", user: u })}
                          className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() =>
                            setModal({ type: "password", user: u })
                          }
                          className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
                        >
                          Senha
                        </button>
                        {u.is_active && (
                          <button
                            onClick={async () => {
                              if (
                                confirm(`Desativar o usuário "${u.name}"?`)
                              ) {
                                await deactivateUser.mutateAsync(u.id);
                              }
                            }}
                            className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                          >
                            Desativar
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <UserModal
          modal={modal}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function UserModal({
  modal,
  onClose,
}: {
  modal: NonNullable<Modal>;
  onClose: () => void;
}) {
  const createUser = useCreateUser();
  const updateUser = useUpdateUser(
    modal.type !== "create" ? modal.user.id : ""
  );
  const updatePassword = useUpdateUserPassword(
    modal.type === "password" ? modal.user.id : ""
  );

  const [form, setForm] = useState(
    modal.type === "create"
      ? { name: "", email: "", password: "", role: "VENDEDOR" as const }
      : modal.type === "edit"
      ? {
          name: modal.user.name,
          email: modal.user.email,
          role: modal.user.role,
        }
      : { password: "" }
  );
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (modal.type === "create") {
        const f = form as {
          name: string;
          email: string;
          password: string;
          role: "GERENTE" | "VENDEDOR";
        };
        if (!f.name || !f.email || !f.password) {
          setError("Todos os campos são obrigatórios");
          return;
        }
        await createUser.mutateAsync(f);
      } else if (modal.type === "edit") {
        const f = form as {
          name: string;
          email: string;
          role: "GERENTE" | "VENDEDOR";
        };
        await updateUser.mutateAsync(f);
      } else {
        const f = form as { password: string };
        if (!f.password || f.password.length < 6) {
          setError("Senha deve ter no mínimo 6 caracteres");
          return;
        }
        await updatePassword.mutateAsync({ password: f.password });
      }
      onClose();
    } catch {
      setError("Erro ao salvar. Tente novamente.");
    }
  }

  const isPending =
    createUser.isPending || updateUser.isPending || updatePassword.isPending;

  const title =
    modal.type === "create"
      ? "Novo usuário"
      : modal.type === "edit"
      ? "Editar usuário"
      : "Alterar senha";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {modal.type !== "password" && (
            <>
              {modal.type === "create" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={(form as { name: string }).name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value } as typeof form)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              {modal.type === "edit" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={(form as { name: string }).name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value } as typeof form)
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={(form as { email: string }).email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value } as typeof form)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Perfil
                </label>
                <select
                  value={(form as { role: string }).role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value } as typeof form)
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="VENDEDOR">Vendedor</option>
                  <option value="GERENTE">Gerente</option>
                </select>
              </div>
            </>
          )}

          {(modal.type === "create" || modal.type === "password") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={(form as { password: string }).password}
                onChange={(e) =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  } as typeof form)
                }
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isPending}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? "Salvando..." : "Salvar"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
