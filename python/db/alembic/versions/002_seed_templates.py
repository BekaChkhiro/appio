"""Seed 5 MVP templates into templates table.

Revision ID: 002_seed_templates
Revises: 001_initial
Create Date: 2026-04-07
"""

from alembic import op
from sqlalchemy import text

revision = "002_seed_templates"
down_revision = "001_initial"
branch_labels = None
depends_on = None

# Use raw SQL with JSONB casting to avoid json.dumps serialization issues.
# Each config_json is a complete JSONB object with components, layouts,
# dataModel, defaultTheme, propSchemas, and constraints.

TEMPLATES_SQL = """
INSERT INTO templates (id, name, display_name, category, config_json, skeleton_path, is_active)
VALUES
(
  'todo-list', 'todo-list', 'To-Do List', 'Productivity',
  '{
    "components": ["TaskList", "TaskItem", "TaskForm", "CategoryFilter", "ProgressBar", "EmptyState"],
    "layouts": ["stack", "tabs"],
    "dataModel": {
      "task": {"id": "string", "title": "string", "description": "string", "category": "string", "completed": "boolean", "dueDate": "date", "priority": "string", "createdAt": "date"}
    },
    "propSchemas": {
      "TaskList": {"filter": "string", "sortBy": "string"},
      "TaskItem": {"taskId": "string", "showDescription": "boolean"},
      "TaskForm": {"defaultCategory": "string", "defaultPriority": "string"},
      "CategoryFilter": {"categories": "string[]"},
      "ProgressBar": {"showPercentage": "boolean"},
      "EmptyState": {"message": "string", "actionLabel": "string"}
    },
    "defaultTheme": {"primary": "#6366f1", "primaryLight": "#818cf8", "background": "#f8fafc", "surface": "#ffffff", "textPrimary": "#0f172a", "textSecondary": "#64748b"},
    "constraints": {"maxPages": 5, "maxComponentsPerPage": 6, "storageBackend": "localStorage"}
  }'::jsonb,
  'packages/templates/todo-list', true
),
(
  'expense-tracker', 'expense-tracker', 'Expense Tracker', 'Finance',
  '{
    "components": ["TransactionList", "TransactionItem", "TransactionForm", "CategoryBreakdown", "MonthlySummary", "Chart", "BalanceCard", "EmptyState"],
    "layouts": ["stack", "tabs"],
    "dataModel": {
      "transaction": {"id": "string", "amount": "number", "description": "string", "category": "string", "type": "string", "date": "date", "createdAt": "date"}
    },
    "propSchemas": {
      "TransactionList": {"filter": "string", "groupBy": "string"},
      "TransactionItem": {"transactionId": "string", "showCategory": "boolean"},
      "TransactionForm": {"defaultType": "string"},
      "CategoryBreakdown": {"period": "string"},
      "MonthlySummary": {"month": "number", "year": "number"},
      "Chart": {"chartType": "string", "period": "string"},
      "BalanceCard": {"showTrend": "boolean"},
      "EmptyState": {"message": "string", "actionLabel": "string"}
    },
    "defaultTheme": {"primary": "#10b981", "primaryLight": "#34d399", "background": "#f0fdf4", "surface": "#ffffff", "textPrimary": "#022c22", "textSecondary": "#6b7280"},
    "constraints": {"maxPages": 5, "maxComponentsPerPage": 6, "storageBackend": "localStorage"}
  }'::jsonb,
  'packages/templates/expense-tracker', true
),
(
  'notes-app', 'notes-app', 'Notes App', 'Productivity',
  '{
    "components": ["NoteList", "NoteItem", "NoteEditor", "FolderList", "SearchBar", "EmptyState"],
    "layouts": ["stack", "tabs"],
    "dataModel": {
      "note": {"id": "string", "title": "string", "content": "string", "folder": "string", "pinned": "boolean", "createdAt": "date", "updatedAt": "date"},
      "folder": {"id": "string", "name": "string", "color": "string"}
    },
    "propSchemas": {
      "NoteList": {"sortBy": "string", "folder": "string"},
      "NoteItem": {"noteId": "string", "showPreview": "boolean"},
      "NoteEditor": {"noteId": "string"},
      "FolderList": {"showCount": "boolean"},
      "SearchBar": {"placeholder": "string"},
      "EmptyState": {"message": "string", "actionLabel": "string"}
    },
    "defaultTheme": {"primary": "#f59e0b", "primaryLight": "#fbbf24", "background": "#fffbeb", "surface": "#ffffff", "textPrimary": "#1c1917", "textSecondary": "#78716c"},
    "constraints": {"maxPages": 5, "maxComponentsPerPage": 6, "storageBackend": "localStorage"}
  }'::jsonb,
  'packages/templates/notes-app', true
),
(
  'quiz-app', 'quiz-app', 'Quiz App', 'Education',
  '{
    "components": ["QuestionCard", "AnswerOption", "ScoreBoard", "Timer", "ResultsScreen", "ProgressIndicator", "QuizList", "EmptyState"],
    "layouts": ["stack", "tabs"],
    "dataModel": {
      "quiz": {"id": "string", "title": "string", "description": "string", "category": "string", "questions": "json", "timeLimit": "number", "createdAt": "date"},
      "attempt": {"id": "string", "quizId": "string", "score": "number", "totalQuestions": "number", "timeTaken": "number", "completedAt": "date"}
    },
    "propSchemas": {
      "QuestionCard": {"questionIndex": "number"},
      "AnswerOption": {"optionIndex": "number", "selected": "boolean"},
      "ScoreBoard": {"showBest": "boolean"},
      "Timer": {"duration": "number", "onExpire": "string"},
      "ResultsScreen": {"attemptId": "string"},
      "ProgressIndicator": {"total": "number", "current": "number"},
      "QuizList": {"category": "string"},
      "EmptyState": {"message": "string", "actionLabel": "string"}
    },
    "defaultTheme": {"primary": "#8b5cf6", "primaryLight": "#a78bfa", "background": "#faf5ff", "surface": "#ffffff", "textPrimary": "#1e1b4b", "textSecondary": "#6b7280"},
    "constraints": {"maxPages": 5, "maxComponentsPerPage": 6, "storageBackend": "localStorage"}
  }'::jsonb,
  'packages/templates/quiz-app', true
),
(
  'habit-tracker', 'habit-tracker', 'Habit Tracker', 'Health',
  '{
    "components": ["HabitList", "HabitItem", "HabitForm", "StreakCounter", "WeeklyChart", "DayGrid", "StatsCard", "EmptyState"],
    "layouts": ["stack", "tabs"],
    "dataModel": {
      "habit": {"id": "string", "name": "string", "icon": "string", "color": "string", "frequency": "string", "createdAt": "date"},
      "completion": {"id": "string", "habitId": "string", "date": "date", "completed": "boolean"}
    },
    "propSchemas": {
      "HabitList": {"date": "string", "filter": "string"},
      "HabitItem": {"habitId": "string", "date": "string"},
      "HabitForm": {"defaultFrequency": "string"},
      "StreakCounter": {"habitId": "string"},
      "WeeklyChart": {"habitId": "string", "weekStart": "string"},
      "DayGrid": {"habitId": "string", "months": "number"},
      "StatsCard": {"metric": "string"},
      "EmptyState": {"message": "string", "actionLabel": "string"}
    },
    "defaultTheme": {"primary": "#ef4444", "primaryLight": "#f87171", "background": "#fef2f2", "surface": "#ffffff", "textPrimary": "#1c1917", "textSecondary": "#6b7280"},
    "constraints": {"maxPages": 5, "maxComponentsPerPage": 6, "storageBackend": "localStorage"}
  }'::jsonb,
  'packages/templates/habit-tracker', true
);
"""


def upgrade() -> None:
    op.execute(text(TEMPLATES_SQL))


def downgrade() -> None:
    op.execute(
        text(
            "DELETE FROM templates WHERE id IN "
            "('todo-list', 'expense-tracker', 'notes-app', 'quiz-app', 'habit-tracker')"
        )
    )
