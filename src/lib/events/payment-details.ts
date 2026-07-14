/** Bank transfer details for LA MESA event payments (Mexico). */
export const EVENT_PAYMENT_BANK = {
  entidad: "NU MEXICO",
  clabe: "638180000156770301",
  cuenta: "00015677030",
  nombre: "Ana Josefina Ramos Miramontes",
  invoiceEmail: "greg@nextstep-services.com",
} as const;

/** 3-day payment window before the seat is released. */
export function paymentDeadlineBlock(locale: "es" | "fr" | "en"): string {
  if (locale === "fr") {
    return [
      "Important — règlement :",
      "Ta participation ne sera validée que si le règlement est effectué d’ici 3 jours. Si ce n’est pas le cas, nous devrons proposer ta place à un autre membre.",
    ].join("\n");
  }
  if (locale === "en") {
    return [
      "Important — payment:",
      "Your spot will only be confirmed once payment is received within 3 days. If not, we will offer your seat to another member.",
    ].join("\n");
  }
  return [
    "Importante — pago:",
    "Tu participación quedará confirmada únicamente si el pago se realiza dentro de un plazo de 3 días. De lo contrario, ofreceremos tu lugar a otro miembro.",
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
