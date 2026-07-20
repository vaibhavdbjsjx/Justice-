/**
 * Supported UI/assistant languages (Part 4.1 — multi-language from the start).
 * The preference is captured at onboarding and stored on the profile; it scopes
 * the assistant's response language. Full UI string translation is a later phase;
 * capturing the preference now keeps the data model honest.
 */

export type Language = { code: string; name: string; nativeName: string };

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "简体中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
];

export const DEFAULT_LANGUAGE = "en";

export function getLanguage(code: string | null | undefined): Language | undefined {
  if (!code) return undefined;
  return LANGUAGES.find((l) => l.code === code);
}

export function languageName(code: string | null | undefined): string {
  return getLanguage(code)?.name ?? "English";
}
