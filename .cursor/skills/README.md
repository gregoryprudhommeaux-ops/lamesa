# Cursor Agent Skills (personal · all projects)

Source of truth: `~/.cursor/skills/`  
Sync into any project (existing or new):

```bash
~/.cursor/scripts/sync-skills-to-project.sh /path/to/project
# or from inside the project:
~/.cursor/scripts/sync-skills-to-project.sh "$(pwd)"
```

| Skill | Slash | Use for |
|-------|-------|---------|
| **mike-strategic-coach** | `/mike-strategic-coach` | Offre, reach, agents, MVP lean, Company of One — « Utilise Mike » |
| **lucy-community-marketing** | `/lucy-community-marketing` | LA MESA community / member marketing |
| **charles-linkedin-strategist** | `/charles-linkedin-strategist` | LinkedIn Gregory / NextStep |
| **anti-linkedin-slop** | `/anti-linkedin-slop` | ANALYZE / HUMANIZE / EVOLVE copy |
| **jerry-ai-saas-expert** | `/jerry-ai-saas-expert` | Pricing / freemium / ICP SaaS |
| **sofia-chen-expert-ux-branding** | `/sofia-chen-expert-ux-branding` | UX / UI / branding |

New project → run the sync script once (and commit `.cursor/skills/` if Cloud Agents need them).
