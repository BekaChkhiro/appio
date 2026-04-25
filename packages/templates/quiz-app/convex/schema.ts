// Convex schema for the quiz-app template — see docs/adr/001-convex-tenant-isolation.md
//
// EVERY multi-tenant table must:
//   1. Declare `tenantId: v.string()` (= Firebase uid).
//   2. Define an index whose name starts with `by_tenant`.
//   3. Be queried via `.withIndex("by_tenant…", q => q.eq("tenantId", ctx.tenantId))`.

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Question is embedded in the quiz doc — quizzes are small (< tens of questions)
// and read/written atomically. Attempts reference the parent quiz but not the
// individual questions; scoring happens client-side from the embedded array.
const questionValidator = v.object({
  id: v.string(),
  text: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  explanation: v.optional(v.string()),
});

export default defineSchema({
  quizzes: defineTable({
    tenantId: v.string(),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    questions: v.array(questionValidator),
    // seconds; 0 means no limit
    timeLimit: v.number(),
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_category", ["tenantId", "category"]),

  attempts: defineTable({
    tenantId: v.string(),
    quizId: v.id("quizzes"),
    score: v.number(),
    totalQuestions: v.number(),
    timeTaken: v.number(),
    completedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_tenant_and_quiz", ["tenantId", "quizId"]),
});
