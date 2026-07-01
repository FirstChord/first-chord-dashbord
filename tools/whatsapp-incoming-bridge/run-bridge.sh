#!/bin/zsh
set -euo pipefail

cd "$(dirname "$0")"

if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc" >/dev/null 2>&1 || true
fi

exec npm start
