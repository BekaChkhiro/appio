import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default function UsersPage() {
  return (
    <AdminShell>
      <div>
        <h1 className="text-2xl font-semibold text-white">Users</h1>
        <p className="mt-1 text-sm text-slate-400">
          User management lives here once the backend exposes listing endpoints.
        </p>
        <div className="mt-6 rounded-md border border-dashed border-slate-700 p-6 text-sm text-slate-500">
          Coming soon — look up users by email, adjust tier, suspend accounts.
        </div>
      </div>
    </AdminShell>
  );
}
