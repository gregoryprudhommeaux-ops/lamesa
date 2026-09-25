# Jack — Ancres multi-projets

Jack est **cross-project**. Adapter le langage métier ; garder les mêmes principes (parcours progressifs, étape active, mémoire relationnelle).

## LA MESA (`lamesa` · lamesasecreta.com)

| Dimension | Ancre |
|-----------|--------|
| Objets métier | Événement / dîner, participation, waitlist, prospect, template email, table draft |
| Rôles | Organisateur (admin), membre, prospect / inscrit express |
| Parcours dominant | **Opérationnel** (ops dîner) + **Consommateur** (membre RSVP → paiement → feedback) + **Commercial** (outreach / STD) |
| Phases événement | Préparation → Audience → STD → Qualification → Invitation formelle → Confirmation & paiement → Prépa dîner → Check-in → Feedback / réactivation |
| Mémoire contact | Waitlist + activités + RSVP + satisfaction + source (ex. FrancoNetwork) |
| Surfaces clés | `/admin/dashboard`, fiche contact, event journey panels, `/compte`, pages publiques `/e/{slug}` |

## Database Perso

| Dimension | Ancre |
|-----------|--------|
| Objets | Contact, liste, activité, sync / upsert |
| Rôles | Opérateur relationnel, fondateur |
| Parcours | **Commercial** + **Opérationnel** (hygiène data) |
| Focus Jack | Profil unifié 4 couches ; pas de “fiche plate” ; next action sur lead/contact |

## Financial Cockpit

| Dimension | Ancre |
|-----------|--------|
| Objets | Compte, période, transaction, forecast, décision cash |
| Rôles | Fondateur, ops finance |
| Parcours | **Opérationnel** + **Projet** (clôture / revue) |
| Focus Jack | Étape active de la période (saisie → revue → décision) ; blocages (manquants, non-réconciliés) |

## Action Learning Workbook

| Dimension | Ancre |
|-----------|--------|
| Objets | Session, engagement, réflexion, feedback, itération |
| Rôles | Facilitateur, participant |
| Parcours | **Projet** + **Consommateur** (apprentissage) |
| Focus Jack | Où en est l’apprenant dans le cycle ; prochaine question / action d’apprentissage |

## Annuaire Guadalajara

| Dimension | Ancre |
|-----------|--------|
| Objets | Profil, validation, recherche, mise en relation |
| Rôles | Membre annuaire, admin validation |
| Parcours | **Consommateur** + **Commercial** (networking) |
| Focus Jack | Découverte → confiance → contact ; gouvernance (validation, consentement) |

## Ultra Content Maker (UCM)

| Dimension | Ancre |
|-----------|--------|
| Objets | Projet contenu, brief, draft, canal, publication |
| Rôles | Solo founder / créateur |
| Parcours | **Projet** + **Opérationnel** (pipeline contenu) |
| Focus Jack | Étape active du contenu (idée → draft → humanize → publish) ; ne pas exposer tous les outils au même niveau ; coordonner avec Jerry (packaging) et anti-linkedin-slop (copy) |

## Sync vers d’autres repos

Dans ce Cloud Agent, seul **LA MESA** est monté. Pour propager Jack :

```bash
# depuis une machine avec tous les repos + ~/.cursor/skills comme source de vérité
cp -R .cursor/skills/jack-ux-product-design /path/to/other-repo/.cursor/skills/
# ou, si le script existe :
~/.cursor/scripts/sync-skills-to-project.sh /path/to/other-repo
```

Puis commit `.cursor/skills/jack-ux-product-design/` dans chaque repo Cloud Agent.
