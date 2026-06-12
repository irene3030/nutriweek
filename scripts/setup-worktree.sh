#!/usr/bin/env bash
# Run once after creating a new git worktree to copy local-only files from the main worktree.
set -euo pipefail

MAIN=$(git worktree list | head -1 | awk '{print $1}')
HERE=$(pwd)

if [ "$HERE" = "$MAIN" ]; then
  echo "Error: run this from within the worktree you just created, not from the main worktree."
  exit 1
fi

if [ -f "$MAIN/.env" ]; then
  cp "$MAIN/.env" .env && echo "✓ .env"
else
  echo "⚠ No .env found in main worktree — copy manually from .env.example"
fi

if [ -f "$MAIN/.netlify/state.json" ]; then
  mkdir -p .netlify
  cp "$MAIN/.netlify/state.json" .netlify/state.json && echo "✓ .netlify/state.json"
else
  echo "⚠ No .netlify/state.json found — run 'netlify link' if you need Netlify functions"
fi

echo "Done. Run 'npm install && npm run dev:local' to start."
