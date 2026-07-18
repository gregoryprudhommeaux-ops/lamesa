# P0 — Parcours membre LA MESA

Playbook ops avant / autour des premières cenas GDL.  
Source de vérité produit : waitlist → perfil → invitación → pago = asiento.

## Funnel (mots officiels)

| Étape | ES | FR | EN |
|-------|----|----|-----|
| 1 | Lista | Liste | Waitlist |
| 2 | Perfil completo | Profil complet | Full profile |
| 3 | Invitación | Invitation | Invitation |
| 4 | Pago confirma el lugar | Paiement = siège | Payment confirms seat |

**Public :** « Mezclamos perfiles a mano » / curation humaine.  
**Interne :** Table Builder (scoring ± IA) + **validation humaine obligatoire** avant envoi d’invites.  
Ne jamais promettre « matching 100 % IA » aux membres.

## Règle 48 h

- **> 48 h** avant la cena : reembolso **ou** crédito pour **une** prochaine cena éligible.
- **≤ 48 h** : paiement retenu.
- Même texte : FAQ (`/fonctionnement`), email invitation, RSVP YES, email confirmation post-paiement.

Si les templates admin ont été customisés en Firestore, réappliquer le bloc *Cancelación / Annulation / Cancellation* ou « Reset defaults » sur :

- `calendar_invite`
- `participation_confirmed`

## Curation (checklist avant invites)

1. Choisir thème + ville.
2. `/admin/tables` → Analyser → brouillon 15 + 5.
3. Revue humaine : conflits concurrentiels, déséquilibre de pouvoir, VIP, no-shows passés.
4. **Enregistrer le brouillon** puis cliquer **Valider humainement**.
5. Créer un événement / ajouter à un event → envoyer invitations.
6. Si tu modifies les sièges après validation, la validation tombe : revalide.

Sans validation, un confirm demande quand même confirmation avant handoff.

## Rituel J+1 (post-cena)

| Timing | Action | Canal |
|--------|--------|-------|
| ~J+1 | Survey satisfaction (cron existant) | Email auto |
| J+1 / J+2 | Thanks court si besoin + **1–2 intros max / personne**, seulement si utile | Email / WhatsApp |
| J+3 | Note CRM : bien à table / à revoir / à prioriser | Admin |
| ~J+7 | Soft unique : « si otra mesa encaja, te escribimos » | Email (pas de série nurture) |

### Script intro (ES — adapter FR/EN)

> Hola [Nombre],  
> Gracias por la mesa de [tema].  
> Si te parece, te conecto con [Nombre] por [razón concreta en una línea].  
> Sin presión — me dices.

### Script soft J+7 (ES)

> Hola [Nombre],  
> Si otra mesa te encaja, te escribimos. Sin spam.  
> LA MESA

## No-show

Noter sur la fiche membre (notes admin) : *no-show sans prévenir* → baisser priorité invite suivante.

## Dry-run avant table 1

1. Inscription test → profil → (simul) invitation → RSVP YES → (simul) paiement.  
2. Vérifier présence des 4 messages : funnel, délai 3 jours paiement, règle 48 h, composition sans liste nominative.  
3. Simuler J+1 : survey + 1 intro fictive + note CRM.
