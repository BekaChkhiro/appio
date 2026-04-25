// Folder operations for the notes-app template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

export const listFolders = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("folders")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("asc")
      .collect(),
});

export const createFolder = tenantMutation({
  args: { name: v.string(), color: v.string() },
  handler: async (ctx, { name, color }) => {
    const trimmedName = String(name).trim();
    if (trimmedName.length === 0) throw new Error("folder name is required");
    if (trimmedName.length > 80) throw new Error("folder name too long");
    return ctx.db.insert("folders", {
      tenantId: ctx.tenantId,
      name: trimmedName,
      color,
      createdAt: Date.now(),
    });
  },
});

export const deleteFolder = tenantMutation({
  args: { id: v.id("folders") },
  handler: async (ctx, { id }) => {
    const folder = await ctx.db.get(id);
    if (folder === null) return;
    if (folder.tenantId !== ctx.tenantId) throw new Error("not authorised");
    // Unlink notes that referenced this folder — deliberate soft-unlink, not cascade-delete,
    // so the agent can surface "moved to unfiled" UX rather than silent data loss.
    const linkedNotes = await ctx.db
      .query("notes")
      .withIndex("by_tenant_and_folder", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("folderId", id),
      )
      .collect();
    for (const note of linkedNotes) {
      await ctx.db.patch(note._id, { folderId: undefined });
    }
    await ctx.db.delete(id);
  },
});
