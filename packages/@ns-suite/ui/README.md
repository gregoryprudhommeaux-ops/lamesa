# @ns-suite/ui

**NS Calque** — design tokens and shared UI for [NS Suite](https://github.com/gregoryprudhommeaux-ops/ultra-content-maker) apps (NextStep Services).

Full specification: [`docs/NS-CALQUE.md`](../../../docs/NS-CALQUE.md) at the monorepo root.

## Quick start (Next.js + Tailwind v4)

```bash
npm install @ns-suite/ui
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "@ns-suite/ui/theme.css";
```

```ts
// next.config.ts
const nextConfig = {
  transpilePackages: ["@ns-suite/ui"],
};
```

```tsx
import { BTN_PRIMARY, NsMark } from "@ns-suite/ui";
import { DashboardPageShell, DashboardPageHero } from "@ns-suite/ui/components";
```

## Exports

| Import | Contents |
|--------|----------|
| `@ns-suite/ui` | Tokens + brand + components |
| `@ns-suite/ui/tokens` | Tailwind class strings (`BTN_PRIMARY`, `INPUT_CLASS`, …) |
| `@ns-suite/ui/brand` | `NsMark`, `NEXTSTEP_COMPANY`, `NS_SUITE_URL` |
| `@ns-suite/ui/components` | Footer, language switcher, dashboard layout, context help |
| `@ns-suite/ui/theme.css` | Tailwind `@theme` color tokens |

## i18n

`NsAppFooter` and `NsLanguageSwitcher` are **headless** (labels + `Link` / `onLocaleChange` props). Wire them with `next-intl` in each app — see Ultra Content Maker wrappers in `src/components/layout/app-footer.tsx`.
