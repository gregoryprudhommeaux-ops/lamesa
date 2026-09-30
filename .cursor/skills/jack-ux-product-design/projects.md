# Jack — Ancres multi-projets

Jack est **cross-project** (DOC : apprendre entre projets sans copier mécaniquement).  
Adapter le langage métier ; garder parcours progressifs, étape active, mémoire relationnelle.

Avant de réemployer un pattern : utilisateurs · risque · volume · device · contraintes business/tech.

## LA MESA (`lamesa` · lamesasecreta.com)

| Dimension | Ancre |
|-----------|--------|
| Objets métier | Événement, participation, waitlist, prospect, template email, table draft, paiement, feedback |
| Rôles | Organisateur (admin), membre, prospect / inscrit express |
| Parcours | **Opérationnel** (ops dîner) + **Consommateur** (RSVP → paiement → feedback) + **Commercial** (outreach / STD) |
| UI cible | Centre de commande événement (pilotage → aperçu → config → audience → coms → participants → after) |
| Surfaces | `/admin/*`, fiche contact, journey panels, `/compte`, `/e/{slug}` |
| Mémoire | `docs/product/PROJECT_MEMORY.md` |

## Database Perso

Commercial + opérationnel (hygiène data) · profil unifié 4 couches · next action sur lead/contact.

## Financial Cockpit

Opérationnel + projet (clôture) · étape active de période · blocages (manquants, non-réconciliés).

## Action Learning Workbook

Projet + consommateur (apprentissage) · où en est l’apprenant · prochaine question/action.

## Annuaire Guadalajara

Consommateur + commercial · découverte → confiance → contact · gouvernance validation/consentement.

## Ultra Content Maker (UCM)

Projet + opérationnel (pipeline contenu) · étape active idée→draft→humanize→publish · Jerry (packaging) + anti-linkedin-slop (copy).

## Sync vers d’autres repos

Ce Cloud Agent n’a que LA MESA. Propager :

```bash
cp -R .cursor/skills/jack-ux-product-design /path/to/other-repo/.cursor/skills/
# ou :
~/.cursor/scripts/sync-skills-to-project.sh /path/to/other-repo
```

Commit `.cursor/skills/jack-ux-product-design/` dans chaque repo Cloud Agent.
