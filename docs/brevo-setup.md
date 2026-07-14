# Setup Brevo (LA MESA)

Remplace Resend pour l’envoi transactionnel (invitations calendrier, RSVP, waitlist, survey).

## 1. Compte Brevo

1. Crée un compte gratuit : [app.brevo.com](https://app.brevo.com)
2. **SMTP & API** → **API keys** → crée une clé (nom : `la-mesa`)
3. Copie la clé → variable `BREVO_API_KEY`

## 2. Expéditeur / domaine

1. **Senders, Domains & Dedicated IPs**
2. Ajoute et vérifie **`lamesasecreta.com`** (DNS SPF / DKIM / DMARC indiqués par Brevo)
   - Ou, en attendant la vérif domaine, ajoute un **sender email** ponctuel (ex. `greg@nextstep-services.com`) après validation du lien Brevo
3. Définis :
   ```
   BREVO_FROM_EMAIL=LA MESA <noreply@lamesasecreta.com>
   ```
   (doit correspondre à un sender/domain validé)

## 3. Variables Vercel (Production + Preview)

```
BREVO_API_KEY=xkeysib-...
BREVO_FROM_EMAIL=LA MESA <noreply@lamesasecreta.com>
```

Puis redéploie.

## 4. Test

Depuis Admin → Événements → **Lancer les invitations**.  
Si erreur, la modale affiche le détail `brevo_4xx:…` (souvent sender non vérifié).

## Notes

- Free Brevo ≈ **300 emails/jour** — largement assez pour LA MESA.
- Les BCC admin (Gregory) restent gérés automatiquement.
- `RESEND_*` n’est plus utilisé par le code.
