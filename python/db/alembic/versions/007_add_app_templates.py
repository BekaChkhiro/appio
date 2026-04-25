"""Add app_templates marketplace table with 10 hand-tuned starters.

Revision ID: 007_app_templates
Revises: 006_add_workspace_persistence
Create Date: 2026-04-16
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "007_app_templates"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "app_templates",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("slug", sa.String(100), unique=True, nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("icon", sa.String(10), nullable=False),
        sa.Column("canonical_prompt", sa.Text(), nullable=False),
        sa.Column("preview_screenshots", JSONB, server_default=sa.text("'[]'::jsonb")),
        sa.Column("template_id", sa.String(100), nullable=True),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0")),
        sa.Column("use_count", sa.Integer(), server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed 10 marketplace starters
    op.execute(sa.text(_SEED_SQL))


def downgrade() -> None:
    op.drop_table("app_templates")


_SEED_SQL = """
INSERT INTO app_templates (slug, name, description, category, icon, canonical_prompt, template_id, is_featured, sort_order)
VALUES
(
  'todo-list',
  'To-Do List',
  'A clean task manager with categories, priorities, due dates, and progress tracking. Organize your day with drag-and-drop sorting and satisfying completion animations.',
  'Productivity',
  '✅',
  'Build a to-do list app with the following features:
- Add tasks with a title, optional description, category (Work, Personal, Shopping, Health), and priority (Low, Medium, High)
- Mark tasks as complete with a satisfying strikethrough animation
- Filter tasks by category and priority
- Show a progress bar at the top showing completed vs total tasks
- Due date picker with overdue highlighting in red
- Swipe to delete on mobile
- Dark mode support
- Store everything in localStorage
- Empty state with a friendly illustration when no tasks exist
Use a clean, minimal design with smooth animations.',
  'todo-list',
  true,
  1
),
(
  'habit-tracker',
  'Habit Tracker',
  'Build lasting habits with daily check-ins, streak tracking, and weekly progress charts. Visual streak counters keep you motivated.',
  'Health',
  '🔥',
  'Build a habit tracker app with these features:
- Add habits with a name, icon (emoji picker), color, and frequency (daily, weekdays, weekends, custom days)
- Daily check-in screen showing today''s habits as a checklist
- Streak counter per habit showing current and best streak
- Weekly bar chart showing completion rate per habit
- GitHub-style contribution grid (green squares) for the last 3 months
- Stats card showing overall completion rate and total completions
- Celebrate streaks with confetti animation at milestones (7, 30, 100 days)
- Dark mode support
- Store in localStorage
Use warm, motivating colors and smooth micro-animations on check-in.',
  'habit-tracker',
  true,
  2
),
(
  'workout-log',
  'Workout Log',
  'Track your exercises, sets, reps, and personal records. Includes a built-in rest timer and workout history with volume charts.',
  'Health',
  '💪',
  'Build a workout logging app with these features:
- Create workout sessions with a name and date
- Add exercises to a session: exercise name, sets × reps × weight (kg/lbs toggle)
- Built-in rest timer between sets (configurable 30s/60s/90s/120s) with countdown animation
- Track personal records per exercise (auto-detect and highlight with a trophy icon)
- Workout history list sorted by date with total volume per session
- Volume chart (line graph) showing progress over time per exercise
- Pre-populated exercise library (Bench Press, Squat, Deadlift, OHP, Pull-ups, etc.)
- Quick-start from previous workout (copy last session as template)
- Dark mode support
- Store in localStorage
Use a bold, gym-inspired design with strong typography.',
  null,
  true,
  3
),
(
  'meal-planner',
  'Meal Planner',
  'Plan your weekly meals, build grocery lists automatically, and track basic nutrition. Never wonder "what''s for dinner?" again.',
  'Lifestyle',
  '🍽️',
  'Build a weekly meal planner app with these features:
- 7-day grid view (Monday–Sunday) with slots for Breakfast, Lunch, Dinner, Snack
- Add meals by name with optional calorie count and tags (Vegetarian, Quick, Meal Prep)
- Tap a slot to assign a meal from your saved recipes or add a new one
- Auto-generate a grocery list from the week''s planned meals (combine duplicate ingredients)
- Grocery list with checkboxes, grouped by category (Produce, Dairy, Protein, Pantry)
- Copy last week''s plan as a starting point
- Daily calorie summary bar
- Dark mode support
- Store in localStorage
Use a fresh, appetizing color palette with food-themed accents.',
  null,
  false,
  4
),
(
  'pet-care',
  'Pet Care',
  'Keep track of feeding schedules, vet appointments, medications, and milestones for your furry friends. Supports multiple pets.',
  'Lifestyle',
  '🐾',
  'Build a pet care tracker app with these features:
- Add pets with name, species (Dog, Cat, Bird, Fish, Other), breed, birthday, photo (emoji avatar as fallback)
- Per-pet dashboard showing upcoming tasks
- Track feeding schedule with reminders (Breakfast, Dinner, custom times)
- Log vet appointments with date, reason, notes, and cost
- Medication tracker with dosage, frequency, and start/end dates
- Weight log with trend chart over time
- Milestone timeline (First walk, First trick, Birthday celebrations)
- Multi-pet switcher in the top navigation
- Dark mode support
- Store in localStorage
Use a playful design with rounded corners and pet-themed illustrations.',
  null,
  false,
  5
),
(
  'plant-care',
  'Plant Care',
  'Never forget to water your plants again. Track watering schedules, sunlight needs, and growth progress with photo logs.',
  'Lifestyle',
  '🌱',
  'Build a plant care app with these features:
- Add plants with name, species, photo (emoji fallback), location (Living Room, Bedroom, Balcony, Kitchen)
- Watering schedule with frequency (every N days) and last-watered date
- Visual watering indicator (green = good, yellow = soon, red = overdue)
- Sunlight requirement tags (Full Sun, Partial, Low Light)
- Growth photo log — add dated photos to see progress over time
- Care tips section per plant (auto-populated based on common species)
- Dashboard showing all plants sorted by "needs water soonest"
- Notification-style banner for plants that need attention today
- Dark mode support
- Store in localStorage
Use an earthy, botanical color scheme with soft greens.',
  null,
  false,
  6
),
(
  'reading-list',
  'Reading List',
  'Track books you want to read, are reading, and have finished. Rate and review books, and track your yearly reading goal.',
  'Productivity',
  '📚',
  'Build a reading list app with these features:
- Add books with title, author, genre, page count, and cover color (since we can''t fetch real covers)
- Three tabs: Want to Read, Currently Reading, Finished
- For "Currently Reading": track current page with a progress bar
- For "Finished": 5-star rating and optional short review
- Yearly reading goal: set target number of books, show progress ring
- Stats: books read this year, total pages, average rating, favorite genre
- Sort by date added, title, or rating
- Search across all books
- Dark mode support
- Store in localStorage
Use a warm, library-inspired design with serif headings and book-spine color accents.',
  null,
  true,
  7
),
(
  'mood-journal',
  'Mood Journal',
  'Log your daily mood with emoji ratings, journal entries, and mood trend charts. Understand your emotional patterns over time.',
  'Health',
  '😊',
  'Build a mood journal app with these features:
- Daily mood entry: pick mood (5 levels: Great, Good, Okay, Bad, Awful) with emoji faces
- Optional journal text entry with the mood
- Tag system for context (Work, Relationships, Health, Weather, Exercise, Sleep)
- Calendar view showing mood colors for each day (green → red gradient)
- Weekly and monthly mood trend line chart
- Mood distribution pie chart (how often each mood appears)
- Streak counter for consecutive days of journaling
- Gratitude prompt: "Name 3 things you''re grateful for" (optional add-on to each entry)
- Dark mode support
- Store in localStorage
Use a calming, therapeutic color palette with gentle gradients and rounded shapes.',
  null,
  true,
  8
),
(
  'journal',
  'Daily Journal',
  'A beautiful, private journal for daily reflections. Write freely with rich formatting, organize by date, and search your memories.',
  'Productivity',
  '📝',
  'Build a daily journal app with these features:
- Create entries with automatic date/time stamp
- Rich text area for writing (support bold, italic via markdown shortcuts)
- Entries organized in a timeline view (newest first)
- Calendar sidebar/strip showing which days have entries (dots on dates)
- Search across all entries by keyword
- Word count per entry
- Writing streak counter (consecutive days with entries)
- Tap on a date in the calendar to jump to that day''s entry
- Pin favorite entries to the top
- Dark mode support
- Store in localStorage
Use an elegant, minimal design inspired by premium notebook apps. Serif font for entry text, sans-serif for UI.',
  null,
  false,
  9
),
(
  'tip-calculator',
  'Tip Calculator',
  'Split bills and calculate tips effortlessly. Supports custom tip percentages, per-person splits, and rounding options.',
  'Utilities',
  '💰',
  'Build a tip calculator app with these features:
- Bill amount input with large, easy-to-tap number display
- Quick tip buttons: 10%, 15%, 18%, 20%, 25%, Custom
- Number of people splitter (1-20 with +/- buttons)
- Real-time calculation showing: tip amount, total with tip, per person amount
- Round up/down toggle (round total to nearest dollar)
- Split unevenly option: adjust individual amounts
- Receipt-style summary card at the bottom
- History of recent calculations (last 10)
- Dark mode support
- Store in localStorage
Use a clean, financial app design with monospace numbers, clear visual hierarchy, and a satisfying calculate animation.',
  null,
  false,
  10
)
ON CONFLICT (slug) DO NOTHING;
"""
