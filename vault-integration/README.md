# Vault-system ↔ Site integration

This directory is the **source of truth** for how `arpyph1/vault-system`
connects to `arpyph1/productimpactpod-site` and runs the content pipeline.

It's kept in the **site repo** (not the vault) because:
- The canonical content taxonomy (themes, formats, entity types) is
  enforced by the Astro build
- The publishing scripts (validate, generate image, dispatch) live here
- When canonicals change, vault-system's publish pipeline picks up the
  change automatically via the submodule bump

---

## Files in this directory

| File | Purpose |
|---|---|
| `README.md` | You are here |
| `vault-folder-structure.md` | Proposed layout for `vault-system/product-impact/` |
| `scaffold-vault.sh` | One-shot script that creates the folders inside vault-system |
| `publish_articles.py.template` | Starter orchestrator — copy into vault-system and customise |
| `article-template.md` | Copy-from source for new article drafts (with frontmatter) |

---

## Quick-start: connecting the two repos

Recommended approach — **Git submodule**. Pins the site to a specific
commit from the vault's perspective, bumps are explicit.

### One-time setup (from vault-system)

```bash
cd ~/code/vault-system
git submodule add \
  https://github.com/arpyph1/productimpactpod-site \
  product-impact/scripts/site

# Initialize folder structure
bash product-impact/scripts/site/vault-integration/scaffold-vault.sh

# Copy the starter publish orchestrator into your scripts dir
cp product-impact/scripts/site/vault-integration/publish_articles.py.template \
   product-impact/scripts/publish_articles.py

# Pin initial commit
git add .gitmodules product-impact/
git commit -m "chore: connect site repo as submodule for publish pipeline"
```

### Updating the site pin

When the site repo gets new features (new validator check, new image
model, taxonomy change, etc):

```bash
cd vault-system/product-impact/scripts/site
git pull origin main
cd -
git add product-impact/scripts/site
git commit -m "chore: bump site submodule"
```

### Fresh clone of vault-system

```bash
git clone --recursive https://github.com/arpyph1/vault-system.git
```

Or after a non-recursive clone:

```bash
git submodule update --init --recursive
```

---

## Daily workflow

```
Draft in vault-system           →  validate → generate image → INSERT  →  CF Pages rebuild →  productimpactpod.com
pre-production → drafts             [publish_articles.py calls: validate_article.py  +  generate_hero_image.py  +  Supabase client  +  dispatch_rebuild.py]
     ↓
drafts/claude-46-platform-shift.md
     ↓
python3 scripts/publish_articles.py drafts/claude-46-platform-shift.md
     ↓
article moves to published/2026/04/  (automated by the orchestrator)
```

---

## What each repo owns

### `productimpactpod-site` (this repo) owns:
- The public site HTML, routes, schemas, RSS, sitemap
- The editorial taxonomy (8 themes, 10 formats, 6 entity types)
- The publishing-pipeline scripts (`scripts/publishing/*`)
- The Supabase schema reference (`docs/supabase-schema.md`)

### `vault-system` owns:
- The markdown source of every article
- The `publish_articles.py` orchestrator
- Pre-production research, source notes, podcast transcripts
- Drafts folder (work in progress)
- Published folder (archive / audit trail)
- Personal notes that never leave the vault

---

## Secrets checklist (before first publish)

| Secret | Where to set | Used by |
|---|---|---|
| `ANTHROPIC_API_KEY` | publisher machine/CI | prompt distillation in `generate_hero_image.py` |
| `REPLICATE_API_TOKEN` | publisher machine/CI | Flux 1.1 Pro image generation |
| `SUPABASE_SERVICE_ROLE_KEY` | publisher machine/CI | Storage uploads (bypasses RLS) |
| `GITHUB_TOKEN` | publisher machine/CI | `dispatch_rebuild.py` API call (PAT with `repo` scope) |
| `CF_DEPLOY_HOOK_URL` | GitHub repo secret | `.github/workflows/publish-trigger.yml` |
| `YOUTUBE_API_KEY` | Supabase Edge Functions secrets | `get-latest-short` edge function |

Run the one-shot verifier to check them all in one go:

```bash
python3 product-impact/scripts/site/scripts/publishing/verify_supabase.py
```

---

## Deciding on a different connection method

If you don't want a git submodule, the alternative is **direct sys.path** —
publisher assumes a sibling checkout of the site repo:

```python
# In publish_articles.py
import os, sys
SITE_REPO = os.environ.get(
    "SITE_REPO",
    os.path.expanduser("~/code/productimpactpod-site"),
)
sys.path.insert(0, os.path.join(SITE_REPO, "scripts/publishing"))
from validate_article import validate
```

Tradeoffs:
- **Submodule**: versioned, reproducible, one more `git pull --recurse-submodules`
- **sys.path**: zero git ceremony, but no version pinning and contributors
  must maintain a parallel checkout

Pick one and delete the other path from `publish_articles.py.template`.
