import { LaMesaShell } from "@/components/la-mesa-shell";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    status?: string;
    response?: string;
    title?: string;
    when?: string;
  }>;
};

function yesCopy(locale: string, title: string, when: string): { title: string; body: string } {
  const eventBit =
    title && when
      ? locale === "en"
        ? `“${title}” on ${when}`
        : locale === "es"
          ? `« ${title} » el ${when}`
          : `« ${title} » le ${when}`
      : title
        ? locale === "en"
          ? `“${title}”`
          : `« ${title} »`
        : when
          ? locale === "en"
            ? `on ${when}`
            : locale === "es"
              ? `el ${when}`
              : `le ${when}`
          : "";

  if (locale === "en") {
    return {
      title: "Thank you for joining!",
      body: [
        eventBit
          ? `You’re registered for this event ${eventBit}.`
          : "You’re registered for this event.",
        "We’re waiting for payment confirmation within 3 days to confirm your spot.",
        "Once that deadline has passed, we will have to offer this seat to another member.",
      ].join("\n\n"),
    };
  }
  if (locale === "es") {
    return {
      title: "¡Gracias por tu participación!",
      body: [
        eventBit
          ? `Estás inscrito/a en este evento ${eventBit}.`
          : "Estás inscrito/a en este evento.",
        "Esperamos la confirmación del pago en un plazo de 3 días para poder confirmar tu participación.",
        "Una vez pasado ese plazo, tendremos que ofrecer este lugar a otro miembro.",
      ].join("\n\n"),
    };
  }
  return {
    title: "Merci de ta participation !",
    body: [
      eventBit
        ? `Tu es bien inscrit(e) à cet événement ${eventBit}.`
        : "Tu es bien inscrit(e) à cet événement.",
      "Nous attendons la confirmation du paiement sous 3 jours afin de pouvoir confirmer ta participation.",
      "Une fois ce délai passé, nous devrons proposer cette place à un autre membre.",
    ].join("\n\n"),
  };
}

export default async function RsvpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const status = sp.status ?? "invalid";
  const response = sp.response ?? "";
  const eventTitle = (sp.title ?? "").trim();
  const eventWhen = (sp.when ?? "").trim();

  const copy =
    status === "ok" && response === "yes"
      ? yesCopy(locale, eventTitle, eventWhen)
      : status === "ok" && response === "no"
        ? locale === "en"
          ? {
              title: "Response recorded",
              body: "You’ve indicated that you won’t attend. Thank you for letting us know.",
            }
          : locale === "es"
            ? {
                title: "Respuesta registrada",
                body: "Indicaste que no participarás. Gracias por responder.",
              }
            : {
                title: "Réponse enregistrée",
                body: "Tu as indiqué que tu ne participeras pas. Merci d’avoir répondu.",
              }
        : status === "not_found"
          ? {
              title:
                locale === "en"
                  ? "Invitation not found"
                  : locale === "es"
                    ? "Invitación no encontrada"
                    : "Invitation introuvable",
              body:
                locale === "en"
                  ? "This link doesn’t match any active invitation."
                  : locale === "es"
                    ? "Este enlace no corresponde a ninguna invitación activa."
                    : "Ce lien ne correspond à aucune invitation active.",
            }
          : {
              title:
                locale === "en"
                  ? "Invalid or expired link"
                  : locale === "es"
                    ? "Enlace inválido o expirado"
                    : "Lien invalide ou expiré",
              body:
                locale === "en"
                  ? "We couldn’t process your response. Contact the LA MESA team if needed."
                  : locale === "es"
                    ? "No pudimos procesar tu respuesta. Contacta al equipo LA MESA si lo necesitas."
                    : "Impossible de traiter ta réponse. Contacte l’équipe LA MESA si besoin.",
            };

  return (
    <LaMesaShell card cardClassName="max-w-lg text-center">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#b4e600]">LA MESA</p>
      <h1 className="mt-4 text-2xl font-bold text-ns-primary">{copy.title}</h1>
      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ns-secondary">
        {copy.body}
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-[#b4e600] px-5 py-2.5 text-sm font-semibold text-[#111]"
      >
        {locale === "en" ? "Back" : locale === "es" ? "Volver" : "Retour"}
      </Link>
    </LaMesaShell>
  );
}
