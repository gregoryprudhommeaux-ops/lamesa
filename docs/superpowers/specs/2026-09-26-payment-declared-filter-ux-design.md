# Design — UX filtre « Virement déclaré » (P1)

Date: 2026-09-26  
Suite Jack — le signal `paymentDeclaredAt` (#54) est là, mais le panneau Confirmation & paiement le traite encore comme « À relancer ».

## Objectif

Que l’admin **voie et confirme** les virements déclarés sans confusion avec la relance email.

## Scope

1. **Select honnête** — une ligne déclarée affiche « Virement déclaré », pas « À relancer ».
2. **Filtre par défaut** — s’il y a ≥1 déclaré → ouvrir sur « Virement déclaré » ; sinon « À relancer ».
3. **CTA Confirmer payé** — bouton primaire sur chaque ligne déclarée (et « Tout confirmer » dans le filtre).
4. **NBA** — si des déclarés restent impayés → « Confirmer les virements déclarés (N) » plutôt que « Relancer les paiements ».

## Hors scope

- Clear `paymentDeclaredAt` (trace audit conservée ; `confirmed` prime déjà sur le journey stage)
- API dédiée batch confirm
- Changement roster Audience

## Vérif

- Unit : `defaultPaymentFilter`, `toInviteMemberStatus`, NBA declared
- UI : filtre déclaré → select = Virement déclaré + bouton Confirmer payé
