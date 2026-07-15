# Changelog · /anti-linkedin-slop · Mr. ANTI-AI-SLOP

## 2026-07-15 (l) — Steven 1.3.2 + Charles/Lucy sync (polished residual)

- NextStep Idea OS Steven prompt bumped `1.3.1` → `1.3.2` with polished residual bans + (k) alignment note.
- `ANTI_SLOP_PROSE_RULE` and Idea OS `.cursor/rules/anti-linkedin-slop-gate.mdc` updated (hard/soft + polished residual).
- Charles + Lucy skills: Idea OS / Steven note now requires polished residual bar (`1.3.2+`).
- Force-synced personal skills → `ns-suite` (was behind); UCM / la-mesa / idea-os skill trees already on (k).

## 2026-07-15 (k) — Polished residual + inline qualification triad

From live UCM post analysis (post soft survey-hook purge):
- Ban **inline** triad: *Même industrie, même fonction, même irritant…* (not only bullet frameworks)
- Ban **clean framework arc**: thesis → preference → community analogy → “je réfléchis à lancer un format” → soft CTA with even paragraph lengths
- Require one sharp qualification criterion + optional friction; no product teaser unless brief asks
- UCM: stronger prompt/checklist; `qualification_triad` weight ↑; Charles/Lucy gate wording

## 2026-07-15 (j) — Idea OS Steven + Charles/Lucy

- Soft survey-hook (h) mirrored into NextStep Idea OS runtime: Steven `1.3.1` + `ANTI_SLOP_PROSE_RULE`.
- Charles + Lucy skills note Idea OS / Steven as same quality bar for product/LLM feedback.
- Project rule + skills README updated; sync to nextstep-idea-os.

## 2026-07-15 (i) — la-mesa app sync

- Force-synced canonical `~/.cursor/skills/` → `Projects/la-mesa/.cursor/skills/` for `anti-linkedin-slop`, `lucy-community-marketing`, `charles-linkedin-strategist`.
- Confirmed project rule `.cursor/rules/anti-linkedin-slop-gate.mdc` (soft survey-hook + Lucy for member templates / Charles for Gregory LinkedIn).

## 2026-07-15 (h) — Soft survey-hook + qualification triad

New tells (same false-consensus arc, softer wording):
- Soft-hear: *phrase que j’entends souvent* / *phrase I often hear* / *frase que escucho* + fabricated category quote
- Dig variants: *En creusant* / *Digging a bit* / *Al indagar*
- Symmetric 3-bullet qualification framework (*même problème / niveau / agenda*)
- Soft antithesis packaging: *moins de X, plus de Y* (twin of *beaucoup… peu…*)

UCM mirrors: banned openers, `SURVEY_HOOK_PATTERNS`, banned-phrases, slop-detector (`soft_survey_hear`, `qualification_triad`, `less_more_packaging`), humanize blocking flags, humanizer compact hints.

Charles + Lucy gate lists updated to treat soft survey-hook as blocking (same as hard).

## 2026-07-15 (g) — UCM server humanize gate

- `humanize-article-pass.ts` runs after generate + revise when slop is detected (FR/EN/ES).
- Repurpose / first-comment / quality prompts inherit anti-slop.

## 2026-07-15 (f) — Wired into Charles + Lucy

- `charles-linkedin-strategist` and `lucy-community-marketing` must run this skill (ANALYZE → HUMANIZE) before delivering copy.
- Synced to UCM, nextstep-idea-os, la-mesa, ns-suite (+ personal ~/.cursor/skills).

## 2026-07-15 (f) — Templates membres explicites

- Lucy + Charles gate wording now explicitly covers **member communication templates** (email/Brevo/WhatsApp/nurture/RSVP).
- Lucy `examples.md`: adapted templates still require ANALYZE → HUMANIZE before ship.
- LA MESA project rule `.cursor/rules/anti-linkedin-slop-gate.mdc` aligned.

## 2026-07-15 (e) — Mr. ANTI-AI-SLOP agent prompt

- Added `PROMPT.md`: full operational agent with ANALYZE / HUMANIZE / EVOLVE modes.
- SKILL.md becomes router to PROMPT.md + reference + examples.
- Synced for all Cursor projects via `~/.cursor/skills/` + user rule.

## 2026-07-15 (d) — Human writing behaviors (beyond blacklist)

- Meta-goal: identifiable author asperities, not “undetectable AI”.
- Variabilité humaine: uneven density, depth zoom, emotion, intentional repetition, certainty hedges, soft-verb purge, common>academic, open closes, cadence.
- Reference sections L–S.

## 2026-07-15 (c) — Syntax tics + voice + anti-overcorrection

- Section K: em dash, not-X-but-Y, triplets, paragraph asymmetry.
- Voice markers, ±15% length, mechanical checklist, examples FR/EN/ES-MX.

## 2026-07-15 (b) — Triple filtre + slop visuel 2026

- FR corporate calques, EN loft vocab, ES Mexico vs Spain, sandwich hooks, school connectors, bullet UI.

## 2026-07-15 (a)

- Initial unified skill: survey-hook + HUMANIZER FR/EN/ES.

## How to log

```
## YYYY-MM-DD
- Pattern name:
- Bad snippet:
- Fix rule:
- UCM synced: yes/no
```
