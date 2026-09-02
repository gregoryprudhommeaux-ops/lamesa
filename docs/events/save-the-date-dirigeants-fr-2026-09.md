# Save the Date — Dirigeants & entrepreneurs français (24 sept. 2026)

## Titre validé

- **Principal :** LA MESA DES DIRIGEANTS ET ENTREPRENEURS FRANÇAIS
- **Sous-titre :** Guadalajara · entraide & réseau d’affaires
- **Slug :** `dirigeants-fr-2026-09-24`

## Faits

| Champ | Valeur |
|-------|--------|
| Date | Mercredi 24 septembre 2026 · 20h |
| Lieu | Centre de Guadalajara — à confirmer selon participants |
| Prix indicatif | $800–$1 000 MXN tout compris (ticket + menu) |
| Deadline réponse | Dimanche 6 septembre 2026 (fin de journée Mexico) |
| Contact | greg@nextstep-services.com |
| Filtre | Français · dirigeant / entrepreneur / fondateur |

## Intro page (FR)

Un dîner entre dirigeants et entrepreneurs français de Guadalajara, autour d’une table assez petite pour que la conversation tienne. On parle de ce qu’on construit ici — business, équipe, décisions — et on se rend utiles les uns aux autres.

La soirée du 24 septembre se compose selon qui répond. Fondateurs, dirigeants, entrepreneurs établis : des gens qui portent déjà une vraie responsabilité. On ne publie pas la liste des noms à l’avance ; le filtre, c’est le profil et l’intention.

C’est un Save the Date. Tu indiques ton intérêt, on calibre le lieu au centre avec le nombre de réponses, puis on te confirme. Selon ta réponse, tu recevras une invitation formelle avec les détails de LA MESA, ainsi que les modalités de règlement à compléter par transfert avant la rencontre, dans les jours qui viennent.

Invitation nominative. Merci de répondre avant dimanche 6 septembre.

## Email

- **Save the Date** (`save_the_date`) — envoi nominatif admin
- **Accusé de réponse** (`interest_ack`) — auto après validation du formulaire (rappel événement + réponse + invitation formelle sous quelques jours)

Remplir [`invite-list.example.csv`](./invite-list.example.csv) puis importer / coller dans l’admin événement (invités) avant l’envoi Save the Date.

Colonnes : `email`, `fullName`, `company`, `source`

## Email FR (draft — anti-slop)

**Objet :** LA MESA · Save the Date — 24 sept. · dirigeants & entrepreneurs français (GDL)

**Corps :**

```
Bonjour {{fullName}},

Save the Date pour un dîner LA MESA réservé aux dirigeants et entrepreneurs français à Guadalajara.

Mercredi 24 septembre 2026 · 20h
Centre de Guadalajara (lieu selon le nombre d’intéressés)

Fourchette indicative : $800–$1 000 MXN tout compris (place + menu). Pas de paiement pour l’instant — on mesure d’abord qui peut venir, pour négocier le restaurant.

Merci de répondre avant dimanche 6 septembre via ce lien :
{{eventUrl}}

Cette invitation est nominative. Seuls les dirigeants / entrepreneurs / fondateurs français sont acceptés. Pour toute question : greg@nextstep-services.com

Si tu n’as pas encore de profil LA MESA, réponds d’abord au Save the Date, puis crée ton compte sur le site — ta réponse reste prise en compte.

À bientôt,
Greg | LA MESA
```

## Soft launch

1. Événement publié : `/fr/e/dirigeants-fr-2026-09-24` (seed script ou admin).
2. Ajouter 5–10 proches en invités (admin → événement → constituer un groupe).
3. Bouton **Envoyer Save the Date** (mode intérêt).
4. Vérifier OUI / NON / motifs dans **Inbox Save the Date**.
5. Blast liste complète avant le 6/09.
6. Relance courte J-1.

Template email système : `save_the_date` (Dashboard → Templates).

Seed :
```bash
node --env-file=.env.local --import tsx scripts/seed-save-the-date-dirigeants-fr.ts
```

