# Ultra Content Maker mirror

Personal skill `~/.cursor/skills/anti-linkedin-slop/` is the living spec (all Cursor projects).
Operational agent: `PROMPT.md` (Mr. ANTI-AI-SLOP · ANALYZE / HUMANIZE / EVOLVE).

When improving the skill, sync these UCM paths:

| Concern | File |
|---------|------|
| Structural bans (generation) | `src/lib/prompts/anti-linkedin-slop.ts` |
| Humanizer rewrite pass | `src/lib/prompts/anti-ai-humanizer.ts` |
| Compact human-writing block | `src/lib/articles/human-writing/human-writing-rules.ts` |
| Rewrite system prompt | `src/lib/articles/human-writing/human-writing-rewrite-prompt.ts` |
| Lexicon flags | `src/lib/articles/human-writing/banned-phrases.ts` |
| Runtime detector | `src/lib/articles/slop-detector.ts` |
| Lint (em dash / not-X-but-Y / triplets) | `src/lib/articles/human-writing/human-writing-lint.ts` |
| Wired into LinkedIn rules | `src/lib/prompts/linkedin-2026-rules.ts` |
| Revise path | `src/lib/prompts/article-revise.ts` |
| Project skill copy | `.cursor/skills/anti-linkedin-slop/` |

Generation = compact anti-slop + human-writing + generation hints.
Humanize / affiner = full humanizer + JSON hook/body/ps.
