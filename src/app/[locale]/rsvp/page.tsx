import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; response?: string }>;
};

export default async function RsvpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = sp.status ?? "invalid";
  const response = sp.response ?? "";

  const copy =
    status === "ok" && response === "yes"
      ? {
          title: "Merci — présence notée",
          body: "Tu es bien inscrit(e) comme Attending. On te confirmera après validation.",
        }
      : status === "ok" && response === "no"
        ? {
            title: "Réponse enregistrée",
            body: "Tu as indiqué que tu ne participeras pas. Merci d’avoir répondu.",
          }
        : status === "not_found"
          ? {
              title: "Invitation introuvable",
              body: "Ce lien ne correspond à aucune invitation active.",
            }
          : {
              title: "Lien invalide ou expiré",
              body: "Impossible de traiter ta réponse. Contacte l’équipe LA MESA si besoin.",
            };

  return (
    <LaMesaShell card cardClassName="max-w-lg text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b4e600]">LA MESA</p>
      <h1 className="mt-4 text-2xl font-bold text-ns-primary">{copy.title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-ns-secondary">{copy.body}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-[#b4e600] px-5 py-2.5 text-sm font-semibold text-[#111]"
      >
        Retour
      </Link>
    </LaMesaShell>
  );
}
