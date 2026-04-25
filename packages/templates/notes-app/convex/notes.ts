// Note operations for the notes-app template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

export const listNotes = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("notes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const listPinnedNotes = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("notes")
      .withIndex("by_tenant_and_pinned", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("pinned", true),
      )
      .order("desc")
      .collect(),
});

export const listNotesByFolder = tenantQuery({
  args: { folderId: v.optional(v.id("folders")) },
  handler: async (ctx, { folderId }) =>
    ctx.db
      .query("notes")
      .withIndex("by_tenant_and_folder", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("folderId", folderId),
      )
      .order("desc")
      .collect(),
});

export const getNote = tenantQuery({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get(id);
    if (note === null) return null;
    if (note.tenantId !== ctx.tenantId) return null;
    return note;
  },
});

export const createNote = tenantMutation({
  args: {
    title: v.string(),
    content: v.string(),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, { title, content, folderId }) => {
    const trimmedTitle = String(title).trim();
    if (trimmedTitle.length === 0) throw new Error("title is required");
    if (trimmedTitle.length > 280) throw new Error("title too long");
    if (content.length > 100_000) throw new Error("content too long");
    if (folderId !== undefined) {
      const folder = await ctx.db.get(folderId);
      if (folder === null || folder.tenantId !== ctx.tenantId) {
        throw new Error("folder not found");
      }
    }
    const now = Date.now();
    return ctx.db.insert("notes", {
      tenantId: ctx.tenantId,
      title: trimmedTitle,
      content,
      folderId,
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateNote = tenantMutation({
  args: {
    id: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, { id, title, content, folderId }) => {
    const note = await ctx.db.get(id);
    if (note === null) throw new Error("not found");
    if (note.tenantId !== ctx.tenantId) throw new Error("not authorised");
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (title !== undefined) {
      const trimmedTitle = String(title).trim();
      if (trimmedTitle.length === 0) throw new Error("title is required");
      if (trimmedTitle.length > 280) throw new Error("title too long");
      patch.title = trimmedTitle;
    }
    if (content !== undefined) {
      if (content.length > 100_000) throw new Error("content too long");
      patch.content = content;
    }
    if (folderId !== undefined) {
      if (folderId === null) {
        patch.folderId = undefined;
      } else {
        const folder = await ctx.db.get(folderId);
        if (folder === null || folder.tenantId !== ctx.tenantId) {
          throw new Error("folder not found");
        }
        patch.folderId = folderId;
      }
    }
    await ctx.db.patch(id, patch);
  },
});

export const togglePin = tenantMutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get(id);
    if (note === null) throw new Error("not found");
    if (note.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.patch(id, {
      pinned: !note.pinned,
      updatedAt: Date.now(),
    });
  },
});

export const deleteNote = tenantMutation({
  args: { id: v.id("notes") },
  handler: async (ctx, { id }) => {
    const note = await ctx.db.get(id);
    if (note === null) return;
    if (note.tenantId !== ctx.tenantId) throw new Error("not authorised");
    await ctx.db.delete(id);
  },
});
