import { AdminShell } from "@/components/admin-shell";
import { CostDashboard } from "@/components/cost-dashboard";

export const dynamic = "force-dynamic";

export default function CostsPage() {
  return (
    <AdminShell>
      <CostDashboard />
    </AdminShell>
  );
}
