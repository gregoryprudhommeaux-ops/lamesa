import { TEMPLATE_LOCALES } from "@/lib/email/template-defaults";
import type { EmailTemplateLocaleContent, TemplateLocale } from "@/lib/types/events";

const VAR_RE = /\{\{[a-zA-Z0-9_]+\}\}/g;
const CHUNK_MAX = 450;

export function maskTemplateVars(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(VAR_RE, (match) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__LMVAR${idx}__`;
  });
  return { masked, tokens };
}

export function unmaskTemplateVars(text: string, tokens: string[]): string {
  let out = text;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = `__LMVAR${i}__`;
    // Tolerant of translator mangling (spaces / case)
    const loose = new RegExp(`__\\s*LMVAR\\s*${i}\\s*__`, "gi");
    out = out.replaceAll(token, tokens[i]).replace(loose, tokens[i]);
  }
  return out;
}

function splitChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];
  const parts = text.split(/(\n+)/);
  const chunks: string[] = [];
  let current = "";
  for (const part of parts) {
    if (!part) continue;
    if (current.length + part.length <= maxLen) {
      current += part;
      continue;
    }
    if (current) chunks.push(current);
    if (part.length <= maxLen) {
      current = part;
      continue;
    }
    // Hard-split oversized segment
    for (let i = 0; i < part.length; i += maxLen) {
      chunks.push(part.slice(i, i + maxLen));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks;
}

async function translateWithMyMemory(
  text: string,
  from: TemplateLocale,
  to: TemplateLocale,
): Promise<string> {
  if (!text.trim()) return text;
  const chunks = splitChunks(text, CHUNK_MAX);
  const translated: string[] = [];
  for (const chunk of chunks) {
    if (!chunk.trim()) {
      translated.push(chunk);
      continue;
    }
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", chunk);
    url.searchParams.set("langpair", `${from}|${to}`);
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) {
      throw new Error(`mymemory_http_${res.status}`);
    }
    const json = (await res.json()) as {
      responseStatus?: number;
      responseData?: { translatedText?: string };
      responseDetails?: string;
    };
    const out = json.responseData?.translatedText?.trim();
    if (!out || (json.responseStatus && json.responseStatus !== 200)) {
      throw new Error(json.responseDetails ?? "mymemory_failed");
    }
    // MyMemory sometimes HTML-escapes
    translated.push(
      out
        .replaceAll("&quot;", '"')
        .replaceAll("&#39;", "'")
        .replaceAll("&amp;", "&")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">"),
    );
  }
  return translated.join("");
}

function openAiConfig(): { apiKey: string; baseUrl: string; model: string } | null {
  const apiKey =
    process.env.OPENAI_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim() || "";
  if (!apiKey) return null;
  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() ||
    process.env.AI_GATEWAY_BASE_URL?.trim() ||
    "https://api.openai.com/v1"
  ).replace(/\/$/, "");
  const model =
    process.env.OPENAI_TRANSLATE_MODEL?.trim() ||
    process.env.AI_GATEWAY_MODEL?.trim() ||
    "gpt-4o-mini";
  return { apiKey, baseUrl, model };
}

const LOCALE_NAMES: Record<TemplateLocale, string> = {
  es: "Spanish (Mexico)",
  fr: "French",
  en: "English",
};

async function translateWithOpenAi(
  text: string,
  from: TemplateLocale,
  to: TemplateLocale,
  cfg: { apiKey: string; baseUrl: string; model: string },
): Promise<string> {
  if (!text.trim()) return text;
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You translate email template copy. Keep newlines. Never translate or alter tokens like __LMVAR0__. Return only the translation, no quotes or commentary.",
        },
        {
          role: "user",
          content: `Translate from ${LOCALE_NAMES[from]} to ${LOCALE_NAMES[to]}:\n\n${text}`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`openai_http_${res.status}${detail ? `:${detail.slice(0, 120)}` : ""}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("openai_empty");
  return out;
}

async function translateText(
  text: string,
  from: TemplateLocale,
  to: TemplateLocale,
): Promise<string> {
  const { masked, tokens } = maskTemplateVars(text);
  const cfg = openAiConfig();
  const translatedMasked = cfg
    ? await translateWithOpenAi(masked, from, to, cfg)
    : await translateWithMyMemory(masked, from, to);
  return unmaskTemplateVars(translatedMasked, tokens);
}

export async function translateTemplateLocales(input: {
  sourceLocale: TemplateLocale;
  subject: string;
  body: string;
}): Promise<Record<TemplateLocale, EmailTemplateLocaleContent>> {
  const source = input.sourceLocale;
  const out = {} as Record<TemplateLocale, EmailTemplateLocaleContent>;
  out[source] = { subject: input.subject, body: input.body };

  const targets = TEMPLATE_LOCALES.filter((loc) => loc !== source);
  await Promise.all(
    targets.map(async (to) => {
      const [subject, body] = await Promise.all([
        translateText(input.subject, source, to),
        translateText(input.body, source, to),
      ]);
      out[to] = { subject, body };
    }),
  );

  for (const loc of TEMPLATE_LOCALES) {
    if (!out[loc]?.subject?.trim() || !out[loc]?.body?.trim()) {
      throw new Error(`translate_incomplete_${loc}`);
    }
  }
  return out;
}
