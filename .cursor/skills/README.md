# Cursor Agent Skills (personal · all projects)

Source of truth: `~/.cursor/skills/` (when present on the machine).  
In this repo, skills live under `.cursor/skills/` so Cloud Agents can load them.

Sync into any project (existing or new):

```bash
~/.cursor/scripts/sync-skills-to-project.sh /path/to/project
# or from inside the project:
~/.cursor/scripts/sync-skills-to-project.sh "$(pwd)"
# manual fallback — copy one skill:
cp -R .cursor/skills/jack-ux-product-design /path/to/other-repo/.cursor/skills/
```

| Skill | Slash | Use for |
|-------|-------|---------|
| **mike-strategic-coach** | `/mike-strategic-coach` | Offre, reach, agents, MVP lean, Company of One — « Utilise Mike » |
| **lucy-community-marketing** | `/lucy-community-marketing` | LA MESA community / member marketing |
| **charles-linkedin-strategist** | `/charles-linkedin-strategist` | LinkedIn Gregory / NextStep |
| **anti-linkedin-slop** | `/anti-linkedin-slop` | ANALYZE / HUMANIZE / EVOLVE copy |
| **jerry-ai-saas-expert** | `/jerry-ai-saas-expert` | Pricing / freemium / ICP SaaS |
| **sofia-chen-expert-ux-branding** | `/sofia-chen-expert-ux-branding` | UX / UI / branding visuel |
| **jack-ux-product-design** | `/jack-ux-product-design` | Parcours progressifs, étape active, mémoire relationnelle — « Utilise Jack » |

**Jack vs Sofia:** Jack = flows / next best action / contact memory. Sofia = craft UI, brand, typography.

New project → run the sync script once (and commit `.cursor/skills/` if Cloud Agents need them).  
Jack is intended for: LA MESA, Database Perso, Financial Cockpit, Action Learning Workbook, Annuaire Guadalajara, Ultra Content Maker (see `jack-ux-product-design/projects.md`).
