export const SURVEY_SCORE_FIELDS = [
  "venueQuality",
  "menuQuality",
  "guestsQuality",
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
      wouldReturn: "¿Te gustaría que te invitemos a otras mesas en el futuro (según la temática)?",
      wouldRecommend: "¿Recomendarías el concepto LA MESA?",
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
      wouldReturn:
        "Aimerais-tu qu’on t’invite à d’autres tables dans l’avenir (selon la thématique) ?",
      wouldRecommend: "Recommanderais-tu le concept LA MESA ?",
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
      wouldReturn:
        "Would you like us to invite you to other tables in the future (depending on the theme)?",
      wouldRecommend: "Would you recommend the LA MESA concept?",
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
