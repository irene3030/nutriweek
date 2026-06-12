#!/usr/bin/env bash
# Run from within a worktree once its branch has been merged.
# Removes the worktree directory and deletes the local (and optionally remote) branch.
set -euo pipefail

CURRENT=$(pwd)
BRANCH=$(git branch --show-current)
MAIN=$(git worktree list | head -1 | awk '{print $1}')

if [ "$CURRENT" = "$MAIN" ]; then
  echo "Error: run this from within the worktree you want to remove, not from the main worktree."
  exit 1
fi

if [ -z "$BRANCH" ]; then
  echo "Error: worktree is in detached HEAD state — cannot determine branch to delete."
  exit 1
fi

echo "Worktree : $CURRENT"
echo "Branch   : $BRANCH"
read -rp "¿Continuar? [y/N] " CONFIRM
[[ "$CONFIRM" =~ ^[Yy]$ ]] || { echo "Abortado."; exit 0; }

cd "$MAIN"
git worktree remove "$CURRENT" --force
echo "✓ worktree eliminado"

git branch -d "$BRANCH" 2>/dev/null || {
  echo "⚠ La rama no está fully merged. ¿Borrarla igualmente? [y/N]"
  read -rp "" FORCE
  [[ "$FORCE" =~ ^[Yy]$ ]] && git branch -D "$BRANCH" && echo "✓ rama local eliminada (forzado)"
} && echo "✓ rama local eliminada"

read -rp "¿Borrar también origin/$BRANCH? [y/N] " REMOTE
if [[ "$REMOTE" =~ ^[Yy]$ ]]; then
  git push origin --delete "$BRANCH" && echo "✓ rama remota eliminada"
fi

echo "Listo. Estás en: $(pwd)"
