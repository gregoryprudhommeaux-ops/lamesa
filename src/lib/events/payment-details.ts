/** Bank transfer details for LA MESA event payments (Mexico). */
export const EVENT_PAYMENT_BANK = {
  entidad: "NU MEXICO",
  clabe: "638180000156770301",
  cuenta: "00015677030",
  nombre: "Ana Josefina Ramos Miramontes",
  invoiceEmail: "greg@nextstep-services.com",
} as const;

/** Calendar date for payment deadline (America/Mexico_City), e.g. "20 septembre 2026". */
export function formatPaymentDeadlineDate(
  iso: string,
  locale: "es" | "fr" | "en",
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(
    locale === "en" ? "en-US" : locale === "es" ? "es-MX" : "fr-FR",
    {
      timeZone: "America/Mexico_City",
      year: "numeric",
      month: "long",
      day: "numeric",
    },
  );
}

/**
 * ACCESS payment deadline copy for invite emails.
 * Prefer an event-level `paymentDeadlineAt`; otherwise a generic butoir wording (no fixed 3 days).
 */
export function paymentDeadlineBlock(
  locale: "es" | "fr" | "en",
  deadlineAt?: string | null,
): string {
  const dateLabel = deadlineAt?.trim()
    ? formatPaymentDeadlineDate(deadlineAt.trim(), locale)
    : "";

  if (locale === "fr") {
    const when = dateLabel
      ? `au plus tard le ${dateLabel}`
      : "avant la date butoir indiquée pour cet événement";
    return [
      "Important — règlement ACCESS :",
      `Ta place ne sera validée que si le ticket ACCESS est réglé ${when}. Si ce n’est pas le cas, nous devrons proposer ta place à un autre membre.`,
    ].join("\n");
  }
  if (locale === "en") {
    const when = dateLabel
      ? `by ${dateLabel}`
      : "by the payment deadline set for this event";
    return [
      "Important — ACCESS payment:",
      `Your spot will only be confirmed once the ACCESS ticket is paid ${when}. If not, we will offer your seat to another member.`,
    ].join("\n");
  }
  const when = dateLabel
    ? `a más tardar el ${dateLabel}`
    : "antes de la fecha límite indicada para este evento";
  return [
    "Importante — pago ACCESS:",
    `Tu lugar quedará confirmado únicamente si el ticket ACCESS se paga ${when}. De lo contrario, ofreceremos tu lugar a otro miembro.`,
  ].join("\n");
}

/**
 * Limited seats + first-come via payment (over-invite / waitlist possible).
 */
export function seatScarcityBlock(locale: "es" | "fr" | "en"): string {
  if (locale === "fr") {
    return [
      "Places limitées — premier arrivé, premier servi (selon le règlement) :",
      "Le nombre de places à table est limité. Plusieurs personnes reçoivent cette invitation : ta place est confirmée dès réception du règlement ACCESS. Si la table est déjà complète au moment de ton paiement, tu seras placé(e) en liste d’attente et contacté(e) dès qu’une place se libère.",
    ].join("\n");
  }
  if (locale === "en") {
    return [
      "Limited seats — first come, first served (by payment):",
      "Seats at the table are limited. Several people receive this invitation: your seat is confirmed once we receive the ACCESS payment. If the table is already full when you pay, you will be waitlisted and contacted as soon as a seat opens.",
    ].join("\n");
  }
  return [
    "Lugares limitados — primero en pagar, primero en confirmar:",
    "Hay pocos lugares en la mesa. Varias personas reciben esta invitación: tu lugar se confirma al recibir el pago ACCESS. Si la mesa ya está completa cuando pagues, pasarás a lista de espera y te avisaremos en cuanto se libere un lugar.",
  ].join("\n");
}

/**
 * Cancellation / no-show rule — same wording as FAQ (about.faq.absence)
 * and formal invite emails.
 */
export function cancellationPolicyBlock(locale: "es" | "fr" | "en"): string {
  if (locale === "fr") {
    return [
      "Annulation :",
      "Si tu ne peux pas venir, préviens-nous dès que possible.",
      "- Plus de 24 h avant : crédit pour une prochaine soirée.",
      "- Moins de 24 h : le règlement sera conservé si le paiement au restaurant a déjà été effectué, sinon ce sera un crédit pour un prochain événement.",
    ].join("\n");
  }
  if (locale === "en") {
    return [
      "Cancellation:",
      "If you can’t make it, tell us as soon as you can.",
      "- More than 24 hours ahead: credit toward a future evening.",
      "- Within 24 hours: the payment is kept if you’ve already paid at the restaurant; otherwise you’ll get credit for a future event.",
    ].join("\n");
  }
  return [
    "Cancelación:",
    "Si no puedes ir, avísanos lo antes posible.",
    "- Más de 24 h antes: saldo a favor para una próxima cena.",
    "- Menos de 24 h: se retiene el pago si ya pagaste en el restaurante; si no, será un saldo a favor para un próximo evento.",
  ].join("\n");
}

/** Bank details + CSF invoice instructions for email templates (ES / FR / EN). */
export function paymentBankBlock(locale: "es" | "fr" | "en"): string {
  const b = EVENT_PAYMENT_BANK;
  if (locale === "fr") {
    return [
      "Coordonnées bancaires pour le virement :",
      `Entidad: ${b.entidad}`,
      `Número CLABE: ${b.clabe}`,
      `Número de cuenta: ${b.cuenta}`,
      `Nombre: ${b.nombre}`,
      "",
      `Pour une facture : réponds à cet email (ou écris à ${b.invoiceEmail}) en joignant le CSF (Constancia de Situación Fiscal) de ta société.`,
    ].join("\n");
  }
  if (locale === "en") {
    return [
      "Bank details for transfer:",
      `Entidad: ${b.entidad}`,
      `Número CLABE: ${b.clabe}`,
      `Número de cuenta: ${b.cuenta}`,
      `Nombre: ${b.nombre}`,
      "",
      `For an invoice: reply to this email (or write to ${b.invoiceEmail}) attaching your company’s CSF (Constancia de Situación Fiscal).`,
    ].join("\n");
  }
  return [
    "Datos para transferencia bancaria (SPEI):",
    `Entidad: ${b.entidad}`,
    `CLABE: ${b.clabe}`,
    `Número de cuenta: ${b.cuenta}`,
    `Beneficiario: ${b.nombre}`,
    "",
    `Para solicitar factura: responde a este correo (o escribe a ${b.invoiceEmail}) adjuntando la Constancia de Situación Fiscal (CSF) de tu empresa.`,
  ].join("\n");
}
