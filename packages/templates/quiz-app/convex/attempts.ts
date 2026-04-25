// Attempt operations for the quiz-app template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

export const listAttempts = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("attempts")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const listAttemptsByQuiz = tenantQuery({
  args: { quizId: v.id("quizzes") },
  handler: async (ctx, { quizId }) =>
    ctx.db
      .query("attempts")
      .withIndex("by_tenant_and_quiz", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("quizId", quizId),
      )
      .order("desc")
      .collect(),
});

export const createAttempt = tenantMutation({
  args: {
    quizId: v.id("quizzes"),
    score: v.number(),
    totalQuestions: v.number(),
    timeTaken: v.number(),
  },
  handler: async (ctx, { quizId, score, totalQuestions, timeTaken }) => {
    const quiz = await ctx.db.get(quizId);
    if (quiz === null || quiz.tenantId !== ctx.tenantId) {
      throw new Error("quiz not found");
    }
    if (!Number.isInteger(score) || score < 0) throw new Error("invalid score");
    if (
      !Number.isInteger(totalQuestions) ||
      totalQuestions < 1 ||
      score > totalQuestions
    ) {
      throw new Error("invalid totalQuestions");
    }
    if (!Number.isFinite(timeTaken) || timeTaken < 0) {
      throw new Error("invalid timeTaken");
    }
    return ctx.db.insert("attempts", {
      tenantId: ctx.tenantId,
      quizId,
      score,
      totalQuestions,
      timeTaken,
      completedAt: Date.now(),
    });
  },
});
