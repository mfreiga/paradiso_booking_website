import { cookies } from "next/headers";
import type { Locale } from "./i18n";

// Reads the visitor's language from the `lang` cookie (set by LanguageSwitch).
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get("lang")?.value;
  return value === "en" ? "en" : "de";
}
