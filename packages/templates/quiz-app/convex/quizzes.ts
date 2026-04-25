// Quiz operations for the quiz-app template.
// All handlers tenant-scoped via tenantQuery / tenantMutation (see base/convex/_helpers.ts).

import { v } from "convex/values";
import { tenantQuery, tenantMutation } from "./_helpers";

const questionArg = v.object({
  id: v.string(),
  text: v.string(),
  options: v.array(v.string()),
  correctIndex: v.number(),
  explanation: v.optional(v.string()),
});

function assertValidQuestions(
  questions: Array<{ text: string; options: string[]; correctIndex: number }>,
): void {
  if (questions.length === 0) throw new Error("quiz must have at least one question");
  if (questions.length > 100) throw new Error("too many questions");
  for (const q of questions) {
    if (q.text.trim().length === 0) throw new Error("question text is required");
    if (q.options.length < 2) throw new Error("question needs at least 2 options");
    if (q.options.length > 10) throw new Error("question has too many options");
    if (
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex >= q.options.length
    ) {
      throw new Error("correctIndex out of range");
    }
  }
}

export const listQuizzes = tenantQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db
      .query("quizzes")
      .withIndex("by_tenant", (q) => q.eq("tenantId", ctx.tenantId))
      .order("desc")
      .collect(),
});

export const listQuizzesByCategory = tenantQuery({
  args: { category: v.string() },
  handler: async (ctx, { category }) =>
    ctx.db
      .query("quizzes")
      .withIndex("by_tenant_and_category", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("category", category),
      )
      .order("desc")
      .collect(),
});

export const getQuiz = tenantQuery({
  args: { id: v.id("quizzes") },
  handler: async (ctx, { id }) => {
    const quiz = await ctx.db.get(id);
    if (quiz === null) return null;
    if (quiz.tenantId !== ctx.tenantId) return null;
    return quiz;
  },
});

export const createQuiz = tenantMutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    questions: v.array(questionArg),
    timeLimit: v.number(),
  },
  handler: async (ctx, { title, description, category, questions, timeLimit }) => {
    const trimmedTitle = String(title).trim();
    if (trimmedTitle.length === 0) throw new Error("title is required");
    if (trimmedTitle.length > 200) throw new Error("title too long");
    if (description.length > 2000) throw new Error("description too long");
    if (!Number.isInteger(timeLimit) || timeLimit < 0) {
      throw new Error("timeLimit must be a non-negative integer (seconds)");
    }
    assertValidQuestions(questions);
    return ctx.db.insert("quizzes", {
      tenantId: ctx.tenantId,
      title: trimmedTitle,
      description,
      category: String(category).trim(),
      questions,
      timeLimit,
      createdAt: Date.now(),
    });
  },
});

export const deleteQuiz = tenantMutation({
  args: { id: v.id("quizzes") },
  handler: async (ctx, { id }) => {
    const quiz = await ctx.db.get(id);
    if (quiz === null) return;
    if (quiz.tenantId !== ctx.tenantId) throw new Error("not authorised");
    // Cascade-delete attempts — a history without the parent quiz has no referential value.
    const linked = await ctx.db
      .query("attempts")
      .withIndex("by_tenant_and_quiz", (q) =>
        q.eq("tenantId", ctx.tenantId).eq("quizId", id),
      )
      .collect();
    for (const a of linked) await ctx.db.delete(a._id);
    await ctx.db.delete(id);
  },
});
