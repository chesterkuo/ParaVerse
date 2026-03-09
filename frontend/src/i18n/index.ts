import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import ko from "./locales/ko.json";
import ja from "./locales/ja.json";
import fr from "./locales/fr.json";
import es from "./locales/es.json";
import vi from "./locales/vi.json";
import th from "./locales/th.json";
import nl from "./locales/nl.json";

export const SUPPORTED_LOCALES = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ko: "한국어",
  ja: "日本語",
  fr: "Français",
  es: "Español",
  vi: "Tiếng Việt",
  th: "ไทย",
  nl: "Nederlands",
} as const;

export type LocaleCode = keyof typeof SUPPORTED_LOCALES;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
      ko: { translation: ko },
      ja: { translation: ja },
      fr: { translation: fr },
      es: { translation: es },
      vi: { translation: vi },
      th: { translation: th },
      nl: { translation: nl },
    },
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "paraverse-lang",
    },
  });

export default i18n;
