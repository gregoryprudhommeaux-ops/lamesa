export const SURVEY_SCORE_FIELDS = [
  "venueQuality",
  "menuQuality",
  "guestsQuality",
  "valueForMoney",
  "wouldReturn",
  "wouldRecommend",
] as const;

export type SurveyScoreField = (typeof SURVEY_SCORE_FIELDS)[number];

export type SurveyLocale = "es" | "fr" | "en";

export type SatisfactionSurveyCopy = {
  title: string;
  intro: string;
  questions: Record<SurveyScoreField, string>;
  commentLabel: string;
  commentPlaceholder: string;
  commentHint: string;
  submit: string;
  submitting: string;
  thanksTitle: string;
  thanksBody: string;
  invalidLink: string;
  previewBanner: string;
  previewDoneTitle: string;
  previewDoneBody: string;
  previewSubmit: string;
  loading: string;
};

export const SURVEY_COPY: Record<SurveyLocale, SatisfactionSurveyCopy> = {
  es: {
    title: "¿Cómo estuvo el evento?",
    intro: "Gracias por participar. Califica de 0 a 5 (5 = excelente).",
    questions: {
      venueQuality: "Calidad del lugar",
      menuQuality: "Calidad del menú",
      guestsQuality: "Calidad de la selección de los demás participantes en general",
      valueForMoney: "Calidad de la experiencia respecto al precio pagado",
      wouldReturn: "¿Te gustaría que te invitemos a otras mesas en el futuro (según la temática)?",
      wouldRecommend:
        "¿Crees que hablarías de tu experiencia para que otros puedan ser invitados algún día?",
    },
    commentLabel: "Todos los comentarios constructivos son bienvenidos",
    commentPlaceholder: "Opcional — cuéntanos qué mejorar o qué te gustó.",
    commentHint: "opcional",
    submit: "Enviar",
    submitting: "Enviando…",
    thanksTitle: "Gracias",
    thanksBody: "Gracias. Lo leemos antes de armar la siguiente mesa.",
    invalidLink:
      "Enlace no válido. Abre el cuestionario desde el correo de agradecimiento.",
    previewBanner: "Vista previa admin — puedes hacer clic; no se guarda nada.",
    previewDoneTitle: "Vista previa OK",
    previewDoneBody:
      "Modo vista previa — no se guardó nada. Cierra esta pestaña cuando hayas validado el contenido.",
    previewSubmit: "Validar la vista previa",
    loading: "Cargando…",
  },
  fr: {
    title: "Comment s’est passé l’événement ?",
    intro: "Merci d’avoir participé. Note de 0 à 5 (5 = excellent).",
    questions: {
      venueQuality: "Qualité du lieu",
      menuQuality: "Qualité du menu",
      guestsQuality: "Qualité de la sélection des autres participants en général",
      valueForMoney: "Qualité de l’expérience par rapport au prix payé",
      wouldReturn:
        "Aimerais-tu qu’on t’invite à d’autres tables dans l’avenir (selon la thématique) ?",
      wouldRecommend:
        "Penses-tu parler de ton expérience pour que d’autres puissent un jour être invités ?",
    },
    commentLabel: "Tous les commentaires constructifs sont les bienvenus",
    commentPlaceholder: "Optionnel — dis-nous quoi améliorer ou ce qui t’a plu.",
    commentHint: "optionnel",
    submit: "Envoyer",
    submitting: "Envoi…",
    thanksTitle: "Merci",
    thanksBody: "Merci. On lit ça avant d’armer la prochaine table.",
    invalidLink:
      "Lien invalide. Ouvre le questionnaire depuis l’email de remerciement.",
    previewBanner: "Aperçu admin — tu peux tout cliquer ; rien n’est enregistré.",
    previewDoneTitle: "Aperçu OK",
    previewDoneBody:
      "Mode aperçu — rien n’a été enregistré. Ferme cet onglet quand tu as validé le contenu.",
    previewSubmit: "Valider l’aperçu",
    loading: "Chargement…",
  },
  en: {
    title: "How was the event?",
    intro: "Thanks for joining. Rate from 0 to 5 (5 = excellent).",
    questions: {
      venueQuality: "Venue quality",
      menuQuality: "Menu quality",
      guestsQuality: "Quality of the overall guest selection",
      valueForMoney: "Quality of the experience relative to the price paid",
      wouldReturn:
        "Would you like us to invite you to other tables in the future (depending on the theme)?",
      wouldRecommend:
        "Would you talk about your experience so others might be invited one day?",
    },
    commentLabel: "All constructive comments are welcome",
    commentPlaceholder: "Optional — tell us what to improve or what you liked.",
    commentHint: "optional",
    submit: "Submit",
    submitting: "Sending…",
    thanksTitle: "Thank you",
    thanksBody: "Thanks. We read this before we build the next table.",
    invalidLink:
      "Invalid link. Open the questionnaire from the thank-you email.",
    previewBanner: "Admin preview — click through freely; nothing is saved.",
    previewDoneTitle: "Preview OK",
    previewDoneBody:
      "Preview mode — nothing was saved. Close this tab when you’ve checked the content.",
    previewSubmit: "Confirm preview",
    loading: "Loading…",
  },
};

export function surveyLocaleFrom(value: string | null | undefined): SurveyLocale {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .slice(0, 2);
  if (key === "fr" || key === "en" || key === "es") return key;
  return "es";
}

export function surveyQuestionsList(locale: SurveyLocale): Array<{ key: SurveyScoreField; label: string }> {
  const copy = SURVEY_COPY[locale];
  return SURVEY_SCORE_FIELDS.map((key) => ({ key, label: copy.questions[key] }));
}

/** Scored questions only — free-text comment is never required. */
export function countMissingSurveyScores(
  scores: Record<SurveyScoreField, number | null>,
): number {
  return SURVEY_SCORE_FIELDS.filter((key) => scores[key] === null).length;
}

/** Guide shown when submit is blocked because scored answers are missing. */
export function incompleteSurveyMessage(locale: SurveyLocale, missingCount: number): string {
  const n = Math.max(0, Math.floor(missingCount));
  if (n <= 0) return "";
  if (locale === "fr") {
    return n === 1
      ? "Impossible de valider : 1 réponse n’a pas été donnée."
      : `Impossible de valider : ${n} réponses n’ont pas été données.`;
  }
  if (locale === "en") {
    return n === 1
      ? "Can't submit yet: 1 answer is still missing."
      : `Can't submit yet: ${n} answers are still missing.`;
  }
  return n === 1
    ? "No se puede validar: falta 1 respuesta."
    : `No se puede validar: faltan ${n} respuestas.`;
}
