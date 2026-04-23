/**
 * Utilitários de tratamento de erros de API.
 *
 * Fix 2.7 do PLANO_QA.md: substituir `catch {}` genérico por type-guard
 * tipado via AxiosError, exibindo mensagem amigável do backend quando
 * disponível e mensagem genérica para erros 5xx.
 */

import type { AxiosError } from "axios";

interface ApiErrorDetail {
  detail: string | { msg: string; type: string }[];
}

/**
 * Extrai a mensagem de erro amigável de uma resposta da API.
 *
 * - Erros 4xx com `detail` string → retorna a string do backend
 * - Erros 4xx com `detail` array (Pydantic 422) → junta as mensagens
 * - Erros 5xx ou desconhecidos → mensagem genérica
 */
export function extractApiMessage(err: unknown): string {
  const axiosErr = err as AxiosError<ApiErrorDetail>;

  if (axiosErr?.response) {
    const { status, data } = axiosErr.response;

    if (status >= 500) {
      return "Erro interno do servidor. Tente novamente em instantes.";
    }

    if (data?.detail) {
      if (typeof data.detail === "string") {
        return data.detail;
      }
      // Pydantic validation errors (422) → array de {msg, type}
      if (Array.isArray(data.detail)) {
        return data.detail
          .map((d) => d.msg)
          .filter(Boolean)
          .join("; ");
      }
    }

    if (status === 429) {
      return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
    }

    if (status === 401) {
      return "Sessão expirada. Faça login novamente.";
    }

    if (status === 403) {
      return "Você não tem permissão para realizar esta ação.";
    }
  }

  if (axiosErr?.request) {
    return "Sem resposta do servidor. Verifique sua conexão.";
  }

  return "Ocorreu um erro inesperado. Tente novamente.";
}
