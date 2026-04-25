#!/bin/bash
# Test script for /api/v1/generate/ (agent pipeline)
# Usage: FIREBASE_TOKEN=... bash scripts/test-agent.sh
#
# Get a Firebase token: firebase auth:token or from the mobile app's auth state.

TOKEN="${FIREBASE_TOKEN:?Set FIREBASE_TOKEN env var}"

curl -N -X POST http://localhost:8000/api/v1/generate/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Build an anime collection tracker app called \"AniTrack\". Features: Main screen: a list of anime cards, each showing the anime name in bold, genre badge (colored pill), star rating (1-5 filled stars), episode progress (e.g. \"12/24 episodes\"), and a genre emoji on the left (⚔️ Action, 💕 Romance, 😂 Comedy, 👻 Horror, 🚀 Sci-Fi, 🧙 Fantasy, 🍵 Slice of Life, 🎭 Drama, ⚽ Sports, 🔍 Mystery). At the top: a hero card showing total anime count and average rating with a small bar chart using Recharts showing count per genre. Segmented control to filter by status: All / Watching / Completed / Plan to Watch / Dropped. FAB opens a bottom sheet form to add a new anime: name input, genre picker (grid of emoji+label buttons), episode count input, current episode input, star rating selector (tap 1-5 stars), status dropdown. Tap any anime card to edit it (open same bottom sheet pre-filled). Swipe-style delete button on each card. Start with 5 pre-loaded anime: Attack on Titan (Action, 5 stars, 75/75 ep, Completed), Spy x Family (Comedy, 4 stars, 12/25 ep, Watching), Death Note (Mystery, 5 stars, 37/37 ep, Completed), Your Name (Romance, 5 stars, 1/1 ep, Completed), Jujutsu Kaisen (Action, 4 stars, 24/24 ep, Completed). Persist everything to localStorage. Full dark mode with toggle in top bar. Use violet/purple accent color (#8b5cf6). Make it feel like a real anime tracking app — polished, modern, with smooth animations."
  }'
echo
