"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@appio/api-client";
import { Loader2 } from "lucide-react";

type CostSummary = {
  summary: {
    month: {
      total_cost_usd: number;
      total_input_tokens: number;
      total_output_tokens: number;
      total_generations: number;
      period_start: string;
    };
    today: {
      total_cost_usd: number;
      total_generations: number;
      period_start: string;
    };
  };
  top_users: {
    user_id: string;
    total_cost_usd: number;
    generation_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
  }[];
};

function formatUsd(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function CostDashboard() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery<CostSummary>({
    queryKey: ["admin-costs"],
    staleTime: 30_000,
    queryFn: () => api.get<CostSummary>("/api/v1/admin/costs"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading costs…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        Failed to load costs: {error instanceof Error ? error.message : String(error)}
      </div>
    );
  }

  if (!data) return null;

  const { summary, top_users } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Cost monitor</h2>
          <p className="text-sm text-slate-400">
            Monthly + daily Claude API spend across all users.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
        >
          {isRefetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Stat
          label="Today"
          value={formatUsd(summary.today.total_cost_usd)}
          sub={`${formatNum(summary.today.total_generations)} generations`}
        />
        <Stat
          label="This month"
          value={formatUsd(summary.month.total_cost_usd)}
          sub={`${formatNum(summary.month.total_generations)} generations`}
        />
        <Stat
          label="Input tokens (MTD)"
          value={formatNum(summary.month.total_input_tokens)}
        />
        <Stat
          label="Output tokens (MTD)"
          value={formatNum(summary.month.total_output_tokens)}
        />
      </div>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40">
        <header className="border-b border-slate-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-white">Top spenders this month</h3>
        </header>
        {top_users.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">
            No generations recorded this month yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">User ID</th>
                <th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Generations</th>
                <th className="px-4 py-2 text-right">In tokens</th>
                <th className="px-4 py-2 text-right">Out tokens</th>
              </tr>
            </thead>
            <tbody>
              {top_users.map((u) => (
                <tr key={u.user_id} className="border-t border-slate-800 text-slate-300">
                  <td className="px-4 py-2 font-mono text-xs">{u.user_id}</td>
                  <td className="px-4 py-2 text-right">{formatUsd(u.total_cost_usd)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(u.generation_count)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(u.total_input_tokens)}</td>
                  <td className="px-4 py-2 text-right">{formatNum(u.total_output_tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
