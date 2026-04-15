#!/usr/bin/env bash
#
# scaffold-vault.sh — create the proposed folder structure inside vault-system.
#
# Run from vault-system root:
#   bash product-impact/scripts/site/vault-integration/scaffold-vault.sh
#
# Idempotent — safe to re-run; it creates missing directories but never
# overwrites existing files. Prints a summary of what it did.

set -euo pipefail

VAULT_ROOT="${VAULT_ROOT:-$(pwd)}"
BASE="${VAULT_ROOT}/product-impact"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "${VAULT_ROOT}/.git" ]; then
  echo "✗ Run this from the root of vault-system (a git repo)" >&2
  echo "  Current: ${VAULT_ROOT}" >&2
  exit 1
fi

created=0
skipped=0

make_dir() {
  if [ -d "$1" ]; then
    skipped=$((skipped + 1))
  else
    mkdir -p "$1"
    created=$((created + 1))
    echo "  + $1"
  fi
}

copy_if_missing() {
  local src="$1"
  local dst="$2"
  if [ -f "$dst" ]; then
    skipped=$((skipped + 1))
  elif [ -f "$src" ]; then
    cp "$src" "$dst"
    created=$((created + 1))
    echo "  + $dst"
  fi
}

echo "Scaffolding ${BASE}…"

# Pre-production
make_dir "${BASE}/pre-production/sources/$(date +%Y-%m)"
make_dir "${BASE}/pre-production/sources/by-topic"
make_dir "${BASE}/pre-production/episodes"
make_dir "${BASE}/pre-production/briefs"

# Drafts + published
make_dir "${BASE}/drafts"
make_dir "${BASE}/published/$(date +%Y)/$(date +%m)"

# Taxonomy + scripts
make_dir "${BASE}/taxonomy"
make_dir "${BASE}/scripts/utils"

# Copy template files from the site repo (only if not already present)
copy_if_missing "${SCRIPT_DIR}/article-template.md"   "${BASE}/drafts/_TEMPLATE.md"
copy_if_missing "${SCRIPT_DIR}/brief-template.md"     "${BASE}/pre-production/briefs/_TEMPLATE.md"
copy_if_missing "${SCRIPT_DIR}/publish_articles.py.template" \
                "${BASE}/scripts/publish_articles.py"
copy_if_missing "${SCRIPT_DIR}/README.md"             "${BASE}/README.md"

# .gitignore (append if missing, don't overwrite)
if [ ! -f "${BASE}/.gitignore" ]; then
  cat > "${BASE}/.gitignore" <<'EOF'
# Local-only scratch
pre-production/scratch/
*.local.md

# Python
__pycache__/
*.pyc
.env
.env.local

# Podcast recording artefacts
pre-production/episodes/**/*.wav
pre-production/episodes/**/*.mp3
pre-production/episodes/**/*.m4a
EOF
  created=$((created + 1))
  echo "  + ${BASE}/.gitignore"
fi

echo ""
echo "✓ Done — ${created} created, ${skipped} already existed"
echo ""
echo "Next steps:"
echo "  1. cd ${VAULT_ROOT}"
echo "  2. Review ${BASE}/scripts/publish_articles.py and customise for your vault parser"
echo "  3. Copy the env vars you need to ${BASE}/.env (gitignored)"
echo "  4. Run: python3 ${BASE}/scripts/site/scripts/publishing/verify_supabase.py"
echo "  5. git add ${BASE}/ && git commit -m 'scaffold: product-impact folder structure'"
