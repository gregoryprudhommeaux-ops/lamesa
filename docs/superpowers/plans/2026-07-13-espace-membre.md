# Espace membre LA MESA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer l’espace membre v1 (onglets Dashboard / Calendrier / Mon profil, `/reglages`, parrainage, soft-delete + Firebase Auth delete, email admin à l’inscription) selon `docs/superpowers/specs/2026-07-13-espace-membre-design.md`.

**Architecture:** Garder `/{locale}/compte` comme hub unique avec `?tab=` ; extraire un `MemberShell` (onglets haut-droite du bloc blanc `max-w-2xl`). Les stats / calendrier / parrainage s’appuient sur des helpers purs + extensions de `/api/me` et de petits endpoints dédiés. Réglages = route séparée `/{locale}/reglages`. Soft-delete via `deletedAt` sur `la_mesa_waitlist`. Emails Resend existants pour confirmation membre + nouveau mail admin.

**Tech Stack:** Next.js 16 App Router, next-intl, Firebase Auth + Admin Firestore, Resend, Zod, Tailwind / `@ns-suite/ui`. Pas de runner de tests aujourd’hui → introduire **Vitest** uniquement pour les helpers purs ; le reste se vérifie avec `npm run lint` + `npm run build` + checklists manuelles.

**Spec:** `docs/superpowers/specs/2026-07-13-espace-membre-design.md`

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/member/dashboard-stats.ts` | Pure: compteurs dashboard |
| `src/lib/member/referral-code.ts` | Pure: génération / validation code parrain |
| `src/lib/member/soft-delete.ts` | Pure: helpers `isSoftDeleted`, filtre |
| `src/lib/types/events.ts` | Étendre `WaitlistRegistration` |
| `src/lib/auth/member.server.ts` | `findWaitlistByEmail` ignore soft-deleted |
| `src/lib/email/send-admin-new-registration.ts` | Mail admin nouvel inscrit |
| `src/lib/email/send-referral-invite.ts` | Mail d’invitation ami (optionnel depuis dashboard) |
| `src/app/api/me/route.ts` | Ajouter `stats`, `referral`, filtre fellows `present`, soft-delete |
| `src/app/api/me/calendar/route.ts` | Events published + flag `invited` |
| `src/app/api/me/referral/route.ts` | Ensure code ; liste filleuls ; send invite email |
| `src/app/api/me/profile/route.ts` | Soft-delete au lieu de hard-delete |
| `src/app/api/register/route.ts` | `ref` code + mail admin |
| `src/app/api/waitlist/route.ts` | Inclure soft-deleted + `referredBy` pour admin |
| `src/components/account/member-shell.tsx` | Onglets + layout |
| `src/components/account/member-dashboard.tsx` | Stats + CTA inviter |
| `src/components/account/member-calendar.tsx` | Grille mois membre |
| `src/components/account/member-profile-panel.tsx` | Formulaire profil (extrait) |
| `src/components/account/member-settings-page.tsx` | Page réglages |
| `src/components/account/member-account-page.tsx` | Orchestrateur tabs (ou supprimer au profit du shell) |
| `src/app/[locale]/compte/page.tsx` | Wire shell |
| `src/app/[locale]/reglages/page.tsx` | Nouvelle page |
| `src/components/la-mesa-shell.tsx` | Lien Réglages si logged-in hors admin |
| `src/components/admin/admin-registrants.tsx` (ou équivalent) | Colonne / filtre parrain |
| `messages/{fr,en,es}.json` | Clés i18n |
| `vitest.config.ts` + `package.json` | Tests unitaires helpers |

---

### Task 1: Vitest + helpers purs (stats, referral, soft-delete)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/member/dashboard-stats.ts`
- Create: `src/lib/member/referral-code.ts`
- Create: `src/lib/member/soft-delete.ts`
- Create: `src/lib/member/dashboard-stats.test.ts`
- Create: `src/lib/member/referral-code.test.ts`
- Create: `src/lib/member/soft-delete.test.ts`
- Modify: `package.json` (scripts + devDependency `vitest`)

- [ ] **Step 1: Ajouter Vitest**

```bash
npm install -D vitest
```

Dans `package.json`, ajouter :

```json
"scripts": {
  "dev": "next dev --webpack -H 127.0.0.1",
  "build": "next build --webpack",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

Créer `vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 2: Écrire les tests soft-delete (échouent)**

`src/lib/member/soft-delete.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import { isSoftDeleted, withoutSoftDeleted } from "./soft-delete";

describe("soft-delete", () => {
  it("detects deletedAt", () => {
    expect(isSoftDeleted({ deletedAt: "2026-01-01T00:00:00.000Z" })).toBe(true);
    expect(isSoftDeleted({})).toBe(false);
    expect(isSoftDeleted({ deletedAt: "" })).toBe(false);
  });

  it("filters soft-deleted rows", () => {
    const rows = [
      { id: "a" },
      { id: "b", deletedAt: "2026-01-01T00:00:00.000Z" },
    ];
    expect(withoutSoftDeleted(rows).map((r) => r.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 3: Implémenter soft-delete**

`src/lib/member/soft-delete.ts` :

```ts
export function isSoftDeleted(row: { deletedAt?: string | null }): boolean {
  return Boolean(row.deletedAt && String(row.deletedAt).trim());
}

export function withoutSoftDeleted<T extends { deletedAt?: string | null }>(
  rows: T[],
): T[] {
  return rows.filter((r) => !isSoftDeleted(r));
}
```

- [ ] **Step 4: Tests referral-code**

`src/lib/member/referral-code.test.ts` :

```ts
import { describe, expect, it } from "vitest";
import {
  buildReferralCode,
  normalizeReferralCode,
  isValidReferralCodeFormat,
} from "./referral-code";

describe("referral-code", () => {
  it("builds PREFIX-SUFF from first name", () => {
    const code = buildReferralCode("Grégory Prudhommeaux", () => "7K");
    expect(code).toBe("GREG-7K");
  });

  it("normalizes and validates", () => {
    expect(normalizeReferralCode(" greg-7k ")).toBe("GREG-7K");
    expect(isValidReferralCodeFormat("GREG-7K")).toBe(true);
    expect(isValidReferralCodeFormat("bad")).toBe(false);
  });
});
```

- [ ] **Step 5: Implémenter referral-code**

`src/lib/member/referral-code.ts` :

```ts
const SUFFIX_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function firstNameToken(fullName: string): string {
  const first = (fullName.trim().split(/\s+/)[0] ?? "USER")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (first.slice(0, 6) || "USER");
}

export function randomSuffix(len = 2, rng: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += SUFFIX_CHARS[Math.floor(rng() * SUFFIX_CHARS.length)]!;
  }
  return out;
}

/** `suffixFactory` injectable for tests — returns the suffix part only (e.g. "7K"). */
export function buildReferralCode(
  fullName: string,
  suffixFactory: () => string = () => randomSuffix(2),
): string {
  return `${firstNameToken(fullName)}-${suffixFactory()}`;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidReferralCodeFormat(code: string): boolean {
  return /^[A-Z]{2,6}-[A-Z0-9]{2,4}$/.test(normalizeReferralCode(code));
}
```

- [ ] **Step 6: Tests + impl dashboard-stats**

`src/lib/member/dashboard-stats.ts` :

```ts
export type InvitationLike = {
  status: string;
  event: { startsAt: string };
};

export type DashboardStats = {
  invitationsReceived: number;
  pastParticipations: number;
  upcomingInvitations: number;
  friendsReferred: number;
};

export function computeDashboardStats(input: {
  invitations: InvitationLike[];
  friendsReferred: number;
  nowMs?: number;
}): DashboardStats {
  const now = input.nowMs ?? Date.now();
  const invitationsReceived = input.invitations.length;
  let upcomingInvitations = 0;
  let pastParticipations = 0;

  for (const inv of input.invitations) {
    const starts = new Date(inv.event.startsAt).getTime();
    if (Number.isNaN(starts)) continue;
    if (starts >= now) {
      upcomingInvitations += 1;
    } else if (inv.status === "present" || inv.status === "invited") {
      pastParticipations += 1;
    }
  }

  return {
    invitationsReceived,
    pastParticipations,
    upcomingInvitations,
    friendsReferred: input.friendsReferred,
  };
}
```

Test : vérifier 4 compteurs avec un mix passé/futur et statuts.

- [ ] **Step 7: Lancer les tests**

```bash
npm test
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/member/
git commit -m "$(cat <<'EOF'
test: add vitest and member domain helpers

EOF
)"
```

---

### Task 2: Types waitlist + soft-delete côté data layer

**Files:**
- Modify: `src/lib/types/events.ts`
- Modify: `src/lib/auth/member.server.ts`
- Modify: `src/app/api/me/profile/route.ts`

- [ ] **Step 1: Étendre `WaitlistRegistration`**

Dans `src/lib/types/events.ts`, ajouter sur l’interface :

```ts
  /** Soft-delete — present when member deactivated their profile */
  deletedAt?: string;
  /** Lazy-generated permanent referral code (e.g. GREG-7K) */
  referralCode?: string;
  /** Code used at registration (filleul) */
  referredByCode?: string;
  /** Waitlist doc id of sponsor */
  referredById?: string;
  /** When referral acceptance was recorded (registration with ref) */
  referralAcceptedAt?: string;
```

- [ ] **Step 2: `findWaitlistByEmail` ignore soft-deleted**

Dans `src/lib/auth/member.server.ts`, après avoir trouvé le doc, si `isSoftDeleted(data)` → traiter comme introuvable (return `null`). Importer `isSoftDeleted` depuis `@/lib/member/soft-delete`.

Également : ajouter `findWaitlistByReferralCode(code: string)` (query `referralCode == normalize`, exclure soft-deleted et emails admin).

- [ ] **Step 3: Soft-delete dans `DELETE /api/me/profile`**

Remplacer le hard-delete batch par :

```ts
await db.collection(COLLECTIONS.waitlist).doc(profile.id).set(
  {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  { merge: true },
);

return NextResponse.json({
  ok: true,
  softDeletedProfileId: profile.id,
  // participations conservées volontairement
});
```

Ne plus supprimer les participations. Mettre à jour les messages i18n (`deleteHint`) pour parler de désactivation / soft-delete.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: soft-delete waitlist profiles instead of hard-delete

EOF
)"
```

---

### Task 3: Email admin à chaque nouvelle inscription

**Files:**
- Create: `src/lib/email/send-admin-new-registration.ts`
- Modify: `src/app/api/register/route.ts`
- Modify: `.env.example` (commentaire optionnel)

- [ ] **Step 1: Créer le sender**

Pattern miroir de `send-waitlist-confirmation.ts` : `fetch` Resend, `configuredAdminEmails()` comme destinataires (`to` = tableau), subject `[LA MESA] Nouvel inscrit — {fullName}`, body HTML/text avec tous les champs du record (fullName, email, company, sector, position, city, phone, linkedinUrl, locale, invitationMotivation, ref code si présent).

Retour `{ ok: boolean; error?: string }`. Si `RESEND_API_KEY` absent → `{ ok: false, error: "not_configured" }`.

- [ ] **Step 2: Appeler depuis register (non-bloquant)**

Après succès storage + confirmation membre :

```ts
const adminMail = await sendAdminNewRegistrationEmail(record);
if (!adminMail.ok) {
  console.warn("[register] admin notify skipped/failed:", adminMail.error);
}
```

- [ ] **Step 3: Vérifier manuellement**

Avec Resend configuré : s’inscrire avec un email test → admin reçoit le mail. Si pas de clé Resend en local : confirmer le `console.warn` sans faire échouer `POST`.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: email platform admins on new waitlist registration

EOF
)"
```

---

### Task 4: Parrainage — register `?ref=` + API ensure / invite

**Files:**
- Modify: `src/lib/validation.ts` (champ optionnel `referralCode`)
- Modify: `src/app/api/register/route.ts`
- Create: `src/app/api/me/referral/route.ts`
- Modify: `src/components/profile-registration-form.tsx` (lire `?ref=` de l’URL)
- Modify: `messages/*.json`

- [ ] **Step 1: Validation + enregistrement du lien parrain**

Dans `registrationSchema`, ajouter `referralCode: z.string().trim().optional()`.

Dans `POST /api/register`, si code présent et valide :
1. `findWaitlistByReferralCode`
2. Si trouvé et sponsor **n’est pas** admin (`!isPlatformAdminEmail(sponsor.email)`) et pas soft-deleted → set sur le nouveau record :
   - `referredByCode`, `referredById`, `referralAcceptedAt: now`
3. Sinon ignorer silencieusement le ref (inscription OK sans parrainage)

- [ ] **Step 2: Formulaire inscription**

Sur `/{locale}/inscription?ref=GREG-7K`, lire `searchParams` / `useSearchParams`, passer `referralCode` hidden au POST.

- [ ] **Step 3: `GET|POST /api/me/referral`**

**GET** (auth membre) :
```ts
{
  ok: true,
  referralCode: string | null,
  canBeSponsor: boolean, // false si admin
  inviteUrl: string,     // `${site}/${locale}/inscription?ref=CODE` si code
  referees: Array<{ id, fullName, email, createdAt, referralAcceptedAt }>
}
```

**POST** body discriminated :
- `{ action: "ensure" }` → génère `buildReferralCode(fullName)` si absent ; **403/400** si admin (`canBeSponsor: false`) ; collision → régénérer suffixe jusqu’à 5 essais ; persiste `referralCode` définitif.
- `{ action: "invite_email", email: string, locale?: string }` → ensure code si besoin, envoie `send-referral-invite.ts` (lien + nom du parrain). Rate-limit simple : 1 req / email / profil (ou skip si trop complex pour v1 — documenter).

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: referral codes at registration and member ensure/invite API

EOF
)"
```

---

### Task 5: Enrichir `/api/me` (stats + fellows present + referral summary)

**Files:**
- Modify: `src/app/api/me/route.ts`

- [ ] **Step 1: Fellows = present only**

Dans `fellowsFor`, filtrer `status === "present"` (en plus d’exclure soi-même).

- [ ] **Step 2: Stats + referral**

Après construction de `pastInvitations` / `upcomingInvitations` :

```ts
const allInvitations = [...pastInvitations, ...upcomingInvitations];
const refereesSnap = profile?.referralCode
  ? await db.collection(COLLECTIONS.waitlist)
      .where("referredByCode", "==", profile.referralCode)
      .get()
  : null;
const friendsReferred = refereesSnap
  ? withoutSoftDeleted(
      refereesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as object), deletedAt: d.data().deletedAt })),
    ).filter((r) => Boolean((r as { referralAcceptedAt?: string }).referralAcceptedAt)).length
  : 0;

const stats = computeDashboardStats({
  invitations: allInvitations,
  friendsReferred,
});
```

Retour JSON enrichi :

```ts
{
  ok: true,
  profile,
  notOnWaitlist,
  pastInvitations,
  upcomingInvitations,
  stats,
  referral: {
    code: profile?.referralCode ?? null,
    canBeSponsor: !isAdmin,
  },
  isAdmin,
}
```

Note : un admin peut avoir un profil waitlist ; `canBeSponsor` doit être `!isPlatformAdminIdentity({ email })` même si `isAdmin` dérive du même check.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: extend /api/me with dashboard stats and present-only fellows

EOF
)"
```

---

### Task 6: API calendrier membre

**Files:**
- Create: `src/app/api/me/calendar/route.ts`

- [ ] **Step 1: Implémenter GET**

Auth `requireVerifiedUser`. Charger :
1. Tous les events `status == "published"` (query Firestore ; fallback scan si index manquant)
2. Participations du user (comme `/api/me`)

Réponse :

```ts
type CalendarEventDto = {
  id: string;
  slug: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venueName?: string;
  address?: string;
  mapsUrl?: string;
  invited: boolean;
  participationStatus?: string;
  /** Only populated when invited */
  fellows?: Array<{ fullName?: string; companyName?: string; status: "present" }>;
};

// Non-invited: still return title + startsAt + invited:false
// but omit venue/address/mapsUrl/fellows (privacy)
```

Règle privacy : si `!invited`, strip détails lieu / fellows / maps.

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add member calendar API for published dinners

EOF
)"
```

---

### Task 7: MemberShell + routing `?tab=`

**Files:**
- Create: `src/components/account/member-shell.tsx`
- Modify: `src/app/[locale]/compte/page.tsx`
- Modify: `messages/fr.json`, `en.json`, `es.json`
- Refactor: `src/components/account/member-account-page.tsx` (orchestrateur)

- [ ] **Step 1: i18n onglets**

Ajouter sous `account` :

```json
"tabs": {
  "dashboard": "Dashboard",
  "calendrier": "Calendrier",
  "profil": "Mon profil"
}
```

(Traduire EN/ES correctement.)

- [ ] **Step 2: `MemberShell`**

```tsx
"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export type MemberTab = "dashboard" | "calendrier" | "profil";

const TABS: MemberTab[] = ["dashboard", "calendrier", "profil"];

export function MemberShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const t = useTranslations("account");
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as MemberTab) || "dashboard";
  const active = TABS.includes(tab) ? tab : "dashboard";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-[0.06em] text-ns-tertiary">
          {title}
        </h1>
        <nav className="flex items-center gap-1 text-sm font-semibold" aria-label="Member tabs">
          {TABS.map((id) => {
            const href = `/compte?tab=${id}`;
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className={
                  isActive
                    ? "border-b-2 border-ns-primary px-3 py-1 text-ns-primary"
                    : "px-3 py-1 text-ns-secondary hover:text-ns-tertiary"
                }
              >
                {t(`tabs.${id}`)}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}

export function useMemberTab(): MemberTab {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") as MemberTab | null;
  if (tab && TABS.includes(tab)) return tab;
  return "dashboard";
}
```

Wrap contenu compte dans `LaMesaShell card cardClassName="max-w-2xl"` (inchangé) + `RequireAuth` + `MemberShell`.

- [ ] **Step 3: Orchestrateur**

`MemberAccountPage` charge `/api/me` une fois, puis selon `useMemberTab()` rend :
- placeholder temporaire Dashboard / Calendrier
- panel profil existant (extraction progressive Task 8–9)

Redirect login post-auth reste `/{locale}/compte` (landing dashboard).

- [ ] **Step 4: `npm run lint` + commit**

```bash
git commit -m "$(cat <<'EOF'
feat: add member tab shell with compte?tab= routing

EOF
)"
```

---

### Task 8: Panel Mon profil + lien Réglages

**Files:**
- Create: `src/components/account/member-profile-panel.tsx`
- Modify: `src/components/account/member-account-page.tsx`
- Modify: `messages/*.json`

- [ ] **Step 1: Extraire le formulaire**

Déplacer le form d’édition (champs actuels) depuis `member-account-page.tsx` vers `MemberProfilePanel`. Props : `profile`, `onSaved`, `authFetch`.

Retirer de ce panel : liste invitations, delete section (vont ailleurs).

En bas du panel :

```tsx
<Link href="/reglages" className={/* secondary text */}>
  {t("settingsLink")}
</Link>
```

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor: extract member profile panel and link to settings

EOF
)"
```

---

### Task 9: Dashboard UI

**Files:**
- Create: `src/components/account/member-dashboard.tsx`
- Create: `src/lib/email/send-referral-invite.ts` (si pas déjà en Task 4)
- Modify: orchestrateur compte
- Modify: `messages/*.json`

- [ ] **Step 1: UI stats**

Afficher 4 métriques (pas de cards décoratives inutiles — une grille simple de chiffres + labels) depuis `data.stats`.

CTA « Inviter un ami » :
1. `POST /api/me/referral` `{ action: "ensure" }`
2. Afficher le lien copieable `inviteUrl`
3. Form email optionnel → `{ action: "invite_email", email }`
4. Si `!canBeSponsor` (admin) : message « Les comptes admin ne peuvent pas parrainer »

Optionnel : courte liste des filleuls (noms).

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: member dashboard with stats and referral invite CTA

EOF
)"
```

---

### Task 10: Calendrier membre UI

**Files:**
- Create: `src/components/account/member-calendar.tsx`
- Modify: orchestrateur

Réutiliser la logique de grille de `admin-calendar.tsx` (`buildGrid`, navigation mois) **sans** importer les appels admin. Fetch `GET /api/me/calendar`.

- [ ] **Step 1: Rendu**

- Chaque event published apparaît le jour `startsAt`
- Classe visuelle distincte si `invited` (highlight)
- Si `invited` : clic → panneau détail (titre, lieu, heure, fellows present, lien `/{locale}/e/{slug}`)
- Si `!invited` : `aria-disabled` / pas de `onClick` ; style atténué ; title tooltip « Invitation requise » (i18n)

- [ ] **Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: member calendar of published dinners with invite-gated details

EOF
)"
```

---

### Task 11: Page `/reglages`

**Files:**
- Create: `src/app/[locale]/reglages/page.tsx`
- Create: `src/components/account/member-settings-page.tsx`
- Modify: `src/components/la-mesa-shell.tsx` (+ auth)
- Modify: `messages/*.json`

- [ ] **Step 1: Page**

```tsx
// src/app/[locale]/reglages/page.tsx
import { MemberSettingsPage } from "@/components/account/member-settings-page";
import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";

export default async function ReglagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <LaMesaShell card cardClassName="max-w-2xl">
      <MemberSettingsPage />
    </LaMesaShell>
  );
}
```

`MemberSettingsPage` : `RequireAuth` → charge `/api/me` → affiche email + fullName ; lien `/compte?tab=profil` ; bouton logout ; section danger soft-delete (confirm) puis :

```ts
await authFetch("/api/me/profile", { method: "DELETE" });
await user.delete(); // Firebase Auth currentUser
await logout(); // ou redirect inscription si delete invalide session
router.push(`/${locale}/inscription`);
```

Gérer le cas Firebase `requires-recent-login` : message i18n demandant de se reconnecter puis réessayer.

- [ ] **Step 2: Lien chrome Réglages**

Dans `la-mesa-shell.tsx`, remplacer / compléter `TopBarLoginLink` :
- Si `useAuth().user` et pathname ne commence pas par… (admin est hors i18n path — OK) → afficher Lien « Réglages » → `/reglages` (+ éventuellement « Mon espace » → `/compte`)
- Sinon lien Connexion existant
- Sur pages admin (ce shell n’est pas utilisé) → rien à faire

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: dedicated /reglages page with soft-delete and Auth account removal

EOF
)"
```

---

### Task 12: Admin inscrits — colonne / filtre parrain

**Files:**
- Modify: `src/app/api/waitlist/route.ts` (exposer `referralCode`, `referredByCode`, `referredById`, `deletedAt`)
- Modify: composant admin inscrits (chercher `admin-registrants` / `AdminInscrits` sous `src/components/admin/`)

- [ ] **Step 1: API**

Inclure les champs referral + soft-delete dans la liste admin. Ne **pas** filtrer les soft-deleted côté admin (les montrer avec badge « Désactivé »).

- [ ] **Step 2: UI**

- Colonne « Parrain » (`referredByCode` ou nom résolu si facile)
- Filtre : Tous / Avec parrain / Sans parrain / Désactivés
- Ne pas permettre à l’UI admin de « se parrainer » elle-même

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat: admin registrants referral column and soft-delete badge

EOF
)"
```

---

### Task 13: i18n final + nettoyage + vérification

**Files:**
- `messages/fr.json`, `en.json`, `es.json`
- Retirer code mort invitations de l’ancien monolithe si dupliqué
- `src/components/account/member-login-panel.tsx` — garder redirect `/compte`

- [ ] **Step 1: Completer toutes les clés**

Couvrir : tabs, dashboard stats labels, calendar empty/gated, referral copy, settings, soft-delete, admin referee filter, `requires-recent-login`.

- [ ] **Step 2: Vérifications**

```bash
npm test
npm run lint
npm run build
```

Expected: tous PASS / exit 0.

Checklist manuelle :

1. Login membre → `/compte` = Dashboard + onglets haut-droite
2. `?tab=calendrier` → published events ; non-invité non cliquable ; invité → détail + fellows present only
3. `?tab=profil` → edit + lien réglages
4. `/reglages` → logout, soft-delete + Auth delete
5. Inviter un ami → code lazy, lien permanent, email optionnel
6. Inscription `?ref=CODE` → filleul lié ; admin ne peut pas être parrain
7. Nouvelle inscription → mail admin
8. Admin `/admin/inscrits` → colonne / filtre parrain + badge désactivé

- [ ] **Step 3: Commit final**

```bash
git commit -m "$(cat <<'EOF'
chore: finish espace membre i18n and verify build

EOF
)"
```

---

## Spec coverage checklist

| Requirement | Task |
|---|---|
| Onglets haut-droite bloc blanc | 7 |
| Label Calendrier | 7 (i18n) |
| `?tab=` URLs | 7 |
| max-w-2xl | 7 / inchangé shell |
| Calendar all published + highlight invited | 6, 10 |
| Click only if invited | 6, 10 |
| Fellows present only | 5, 10 |
| Profil = own data only | 8 |
| Settings link bottom profil | 8 |
| Dashboard 4 counters | 1, 5, 9 |
| Participations = past present\|invited | 1, 5 |
| Invite = link + email | 4, 9 |
| Parrain si filleul accepte via ref | 4 |
| Admin ≠ parrain | 4, 5, 9 |
| Code dérivé prénom | 1, 4 |
| Code au 1er clic Inviter | 4, 9 |
| Membre = filleuls ; admin colonne | 4, 9, 12 |
| Code définitif | 4 |
| Réglages logged-in hors admin | 11 |
| Settings contents A–E | 11 |
| Page `/reglages` | 11 |
| Soft-delete | 2, 11 |
| Scope v1 complet | Tasks 1–13 |
| Mail admin nouvel inscrit | 3 |

## Placeholder / consistency review

- Pas de TBD dans les tâches.
- `deletedAt` / `referralCode` / `referredByCode` / `referralAcceptedAt` cohérents types → APIs → UI.
- Soft-delete : membre ne voit plus son profil ; admin le voit.
- Participations conservées au soft-delete (changement vs hard-delete actuel, volontaire).
