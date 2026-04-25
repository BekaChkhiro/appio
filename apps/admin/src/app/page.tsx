import { AdminShell } from "@/components/admin-shell";
import { CostDashboard } from "@/components/cost-dashboard";

// Skip SSG — admin is fully gated by runtime auth. Prerendering would
// crash because Firebase can't initialize without client-side env vars.
export const dynamic = "force-dynamic";

export default function AdminHome() {
  return (
    <AdminShell>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Operational overview — cost monitor, users, and abuse signals live here.
        </p>
      </div>
      <CostDashboard />
    </AdminShell>
  );
}
