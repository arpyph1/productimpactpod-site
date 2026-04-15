# Proposed folder structure for `vault-system/product-impact/`

```
vault-system/
└── product-impact/
    ├── README.md                     # workflow overview (copy from vault-integration/)
    │
    ├── pre-production/                # NEW — research before drafting
    │   ├── sources/
    │   │   ├── 2026-04/               # time-bucketed fleeting references
    │   │   │   ├── anthropic-release-2026-04-12.md
    │   │   │   ├── openai-devday-transcript.md
    │   │   │   └── techmeme-agentic-thread.md
    │   │   │
    │   │   └── by-topic/              # long-term topic research
    │   │       ├── ai-agents/
    │   │       │   ├── architecture-notes.md
    │   │       │   └── benchmark-data.md
    │   │       └── enterprise-adoption/
    │   │
    │   ├── episodes/                  # podcast recording artefacts
    │   │   └── ep-042/
    │   │       ├── raw-transcript.md
    │   │       ├── guest-prep.md
    │   │       ├── clips.md
    │   │       └── extraction-summary.md   # feeds article drafts
    │   │
    │   └── briefs/                    # one-paragraph editorial plan per article
    │       ├── _TEMPLATE.md
    │       └── claude-46-platform-shift.md
    │
    ├── drafts/                        # in-progress articles
    │   ├── _TEMPLATE.md               # copy-from with frontmatter
    │   ├── claude-46-platform-shift.md
    │   └── microsoft-copilot-enterprise-rollout.md
    │
    ├── published/                     # post-publish archive (audit trail)
    │   └── 2026/
    │       └── 04/
    │           ├── anthropic-claude-managed-agents-platform-shift.md
    │           └── openai-devday-multimodal.md
    │
    ├── taxonomy/                      # cached copies of site canonicals
    │   ├── README.md                  # "do not edit — regenerated from site"
    │   ├── themes.json
    │   ├── formats.json
    │   └── entities.json              # known entity slugs (for autocomplete
    │                                  # in editor plugins)
    │
    └── scripts/
        ├── publish_articles.py        # main orchestrator (from template)
        ├── site/                      # ← git submodule: productimpactpod-site
        │   └── (site repo checked out here)
        │
        └── utils/
            ├── frontmatter.py         # parse vault YAML frontmatter
            ├── markdown_to_html.py    # marked-equivalent for Python
            └── entity_linker.py       # resolve [[wiki links]] to entity slugs
```

## Lifecycle of a story

```
1. sources/2026-04/openai-release-notes.md     (reference dump)
         ↓
2. briefs/openai-devday-agents-api.md           (editorial framing: 1 para)
         ↓
3. drafts/openai-devday-agents-api.md           (full article in progress)
         ↓
      publish_articles.py drafts/openai-devday-agents-api.md
         ↓  (validates, generates hero image, writes to Supabase, triggers rebuild)
         ↓
4. published/2026/04/openai-devday-agents-api.md  (moved by orchestrator)
         ↓
5. productimpactpod.com/news/openai-devday-agents-api  (live within ~60s)
```

## Which files get `git add`'d?

- `pre-production/sources/` — yes (research record)
- `pre-production/episodes/` — probably yes (shownotes are valuable)
- `pre-production/briefs/` — yes (short, versionable)
- `drafts/` — yes (work-in-progress is valuable history)
- `published/` — yes (audit trail; matches what's on the site)
- `taxonomy/` — yes (cached canonicals for offline lookups)
- `scripts/site/` — yes (submodule pointer; contents come from site repo)
- `scripts/utils/` — yes

## Gitignore candidates

```
# Local-only scratch
pre-production/scratch/
*.local.md

# Python
__pycache__/
*.pyc
.env

# Episode audio (if you store WAV files here temporarily)
pre-production/episodes/**/*.wav
pre-production/episodes/**/*.mp3
```

## Cross-repo conventions

### Article slug
- File basename in `drafts/` and `published/` = the slug
- Must match `articles.slug` in Supabase
- Must match `canonical_url`'s final segment

### Taxonomy sync

When themes or formats change in the site, run:

```bash
python3 scripts/site/scripts/publishing/export_taxonomy.py > taxonomy/themes.json
```

(This script doesn't exist yet — add it when you need it.)
