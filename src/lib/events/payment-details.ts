/** Bank transfer details for LA MESA event payments (Mexico). */
export const EVENT_PAYMENT_BANK = {
  entidad: "NU MEXICO",
  clabe: "638180000156770301",
  cuenta: "00015677030",
  nombre: "Ana Josefina Ramos Miramontes",
  invoiceEmail: "greg@nextstep-services.com",
} as const;

/** Static block for email templates (ES / FR / EN). */
export function paymentBankBlock(locale: "es" | "fr" | "en"): string {
  const b = EVENT_PAYMENT_BANK;
  if (locale === "fr") {
    return [
      "Coordonnées bancaires pour le règlement :",
      `Entidad: ${b.entidad}`,
      `Número CLABE: ${b.clabe}`,
      `Número de cuenta: ${b.cuenta}`,
      `Nombre: ${b.nombre}`,
      "",
      `Pour une facture, envoie ton CSF (Constancia de Situación Fiscal) par email à ${b.invoiceEmail}.`,
    ].join("\n");
  }
  if (locale === "en") {
    return [
      "Bank details for payment:",
      `Entidad: ${b.entidad}`,
      `Número CLABE: ${b.clabe}`,
      `Número de cuenta: ${b.cuenta}`,
      `Nombre: ${b.nombre}`,
      "",
      `For an invoice, please email your CSF (Constancia de Situación Fiscal) to ${b.invoiceEmail}.`,
    ].join("\n");
  }
  return [
    "Datos bancarios para el pago:",
    `Entidad: ${b.entidad}`,
    `Número CLABE: ${b.clabe}`,
    `Número de cuenta: ${b.cuenta}`,
    `Nombre: ${b.nombre}`,
    "",
    `Para solicitar factura, envía tu CSF (Constancia de Situación Fiscal) por email a ${b.invoiceEmail}.`,
  ].join("\n");
}
