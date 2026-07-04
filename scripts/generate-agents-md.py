"""Generate AGENTS.md from CLAUDE.md.

Interim tool until BUILD_PLAN chunk 0.7 ports this to `pnpm generate:agents-md`
(TypeScript, plus a CI freshness check). Run from anywhere:

    python3 scripts/generate-agents-md.py

Marker conventions in CLAUDE.md:
- <!-- source-only:start --> ... <!-- source-only:end -->  — stripped from the
  generated output entirely (meta-commentary only true from CLAUDE.md's vantage).
- <!-- literal:start --> ... <!-- literal:end -->           — copied verbatim,
  exempt from the token swap (facts that don't depend on which agent reads the
  file, e.g. "personas read a target project's CLAUDE.md").
"""

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / "CLAUDE.md"
DST = REPO_ROOT / "AGENTS.md"

text = SRC.read_text()

# Strip source-only content. Consume exactly one trailing newline (the block's
# own line terminator) so adjacent lines stay separated by exactly one break.
text = re.sub(
    r"<!-- source-only:start -->.*?<!-- source-only:end -->\n?",
    "",
    text,
    flags=re.DOTALL,
)

# Protect literal spans from the token swap below.
literal_spans: list[str] = []


def stash_literal(match: re.Match) -> str:
    literal_spans.append(match.group(1))
    return f"__LITERAL_{len(literal_spans) - 1}__"


text = re.sub(
    r"<!-- literal:start -->(.*?)<!-- literal:end -->",
    stash_literal,
    text,
    flags=re.DOTALL,
)

# Sync table, longest-match-first (mirrors chief-clancy's CLAUDE.md <-> AGENTS.md rule).
replacements = [
    (".claude/agents/*.md", ".codex/agents/*.toml"),
    ("Claude Code", "Codex"),
    ("CLAUDE.md", "AGENTS.md"),
    (".claude/", ".codex/"),
    ("Claude", "Codex"),
]

for old, new in replacements:
    text = text.replace(old, new)

for i, span in enumerate(literal_spans):
    text = text.replace(f"__LITERAL_{i}__", span)

header = (
    "<!-- GENERATED FILE — do not hand-edit. Run `python3 scripts/generate-agents-md.py` after editing CLAUDE.md. -->\n"
    '<!-- Sync table: "Claude Code"->"Codex", "CLAUDE.md"->"AGENTS.md", ".claude/"->".codex/", bare "Claude"->"Codex". '
    "Text wrapped in <!-- literal:start/end --> in the source is copied verbatim, exempt from the swap — "
    "it describes a fact about personas' target-repo convention, not about which agent reads this file. -->\n\n"
)

DST.write_text(header + text)
print(f"wrote {DST}")
