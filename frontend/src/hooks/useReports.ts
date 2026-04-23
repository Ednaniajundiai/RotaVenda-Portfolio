import { useQuery } from "@tanstack/react-query";

import api from "@/lib/api";
import { QUERY_KEYS } from "@/lib/constants";

export interface ReportFilters {
  date_from?: string;
  date_to?: string;
  seller_id?: string;
  sale_type?: string;
  payment_mode?: string;
}

export interface SaleReportItem {
  id: string;
  sale_date: string;
  client_name: string;
  seller_name: string;
  amount: number;
  description: string | null;
  sale_type: string;
  payment_mode: string;
}

export interface PaymentReportItem {
  id: string;
  payment_date: string;
  client_name: string;
  seller_name: string;
  amount: number;
  notes: string | null;
}

export interface SalesReport {
  date_from: string | null;
  date_to: string | null;
  total_count: number;
  total_amount: number;
  total_a_vista: number;
  total_fiado: number;
  items: SaleReportItem[];
}

export interface PaymentsReport {
  date_from: string | null;
  date_to: string | null;
  total_count: number;
  total_amount: number;
  items: PaymentReportItem[];
}

export interface SummaryReport {
  date_from: string | null;
  date_to: string | null;
  total_sales: number;
  total_sales_count: number;
  total_a_vista: number;
  total_fiado: number;
  total_payments: number;
  total_payments_count: number;
  saldo_devedor_total: number;
  top_clients: { client_name: string; total_fiado: number }[];
}

function buildParams(filters: ReportFilters): string {
  const p = new URLSearchParams();
  if (filters.date_from) p.set("date_from", filters.date_from);
  if (filters.date_to) p.set("date_to", filters.date_to);
  if (filters.seller_id) p.set("seller_id", filters.seller_id);
  if (filters.sale_type) p.set("sale_type", filters.sale_type);
  if (filters.payment_mode) p.set("payment_mode", filters.payment_mode);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useSalesReport(filters: ReportFilters) {
  return useQuery<SalesReport>({
    queryKey: [...QUERY_KEYS.REPORTS_SALES, filters],
    queryFn: async () => {
      const { data } = await api.get(`/reports/vendas${buildParams(filters)}`);
      return data;
    },
  });
}

export function usePaymentsReport(
  filters: Pick<ReportFilters, "date_from" | "date_to" | "seller_id">
) {
  return useQuery<PaymentsReport>({
    queryKey: [...QUERY_KEYS.REPORTS_PAYMENTS, filters],
    queryFn: async () => {
      const { data } = await api.get(
        `/reports/pagamentos${buildParams(filters)}`
      );
      return data;
    },
  });
}

export function useSummaryReport(
  filters: Pick<ReportFilters, "date_from" | "date_to">
) {
  return useQuery<SummaryReport>({
    queryKey: [...QUERY_KEYS.REPORTS_SUMMARY, filters],
    queryFn: async () => {
      const { data } = await api.get(
        `/reports/resumo${buildParams(filters)}`
      );
      return data;
    },
  });
}
