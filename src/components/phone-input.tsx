"use client";

import {
  PHONE_COUNTRIES,
  buildFullPhone,
  defaultDialCodeForLocale,
  flagEmoji,
  isValidFullPhone,
} from "@/lib/constants/phone-countries";
import { INPUT_CLASS, LABEL_CLASS } from "@/lib/ui/nextstep";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

type PhoneInputProps = {
  id?: string;
  disabled?: boolean;
  required?: boolean;
  resetKey?: number;
  /** Override default registration.fields.phone label */
  label?: string;
};

export function PhoneInput({
  id = "phone",
  disabled,
  required = true,
  resetKey = 0,
  label,
}: PhoneInputProps) {
  const t = useTranslations("registration.fields");
  const locale = useLocale();
  const defaultDial = useMemo(() => defaultDialCodeForLocale(locale), [locale]);
  const [dialCode, setDialCode] = useState(defaultDial);
  const [national, setNational] = useState("");

  useEffect(() => {
    setDialCode(defaultDial);
    setNational("");
  }, [resetKey, defaultDial]);

  const fullPhone = buildFullPhone(dialCode, national);
  const fieldClass = INPUT_CLASS.replace("w-full ", "");

  return (
    <div>
      <label htmlFor={`${id}-national`} className={LABEL_CLASS}>
        {label ?? t("phone")}
      </label>
      <div className="mt-1 grid grid-cols-[8.75rem_minmax(0,1fr)] gap-2">
        <select
          id={`${id}-country`}
          value={dialCode}
          onChange={(e) => setDialCode(e.target.value)}
          disabled={disabled}
          className={`${fieldClass} px-2`}
          aria-label={t("phoneCountryAria")}
        >
          {PHONE_COUNTRIES.map((country) => (
            <option key={`${country.iso}-${country.dialCode}`} value={country.dialCode}>
              {flagEmoji(country.iso)} {country.dialCode}
            </option>
          ))}
        </select>
        <input
          id={`${id}-national`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          minLength={8}
          value={national}
          onChange={(e) => setNational(e.target.value)}
          placeholder={t("phonePlaceholder")}
          disabled={disabled}
          className={INPUT_CLASS}
        />
      </div>
      <input type="hidden" name={id} value={fullPhone} readOnly />
      {national.length > 0 && !isValidFullPhone(fullPhone) && (
        <p className="mt-1 text-xs font-medium text-red-600">{t("phoneIncomplete")}</p>
      )}
    </div>
  );
}

export { buildFullPhone, isValidFullPhone };
