import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, type LocaleCode } from "@/i18n";
import { Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentLocale = (i18n.language || "en") as LocaleCode;
  const currentLabel = SUPPORTED_LOCALES[currentLocale] || SUPPORTED_LOCALES.en;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded transition-colors cursor-pointer"
        aria-label="Change language"
      >
        <Globe className="w-4 h-4" />
        {!compact && <span>{currentLabel}</span>}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-50 max-h-80 overflow-y-auto">
          {(Object.entries(SUPPORTED_LOCALES) as [LocaleCode, string][]).map(([code, label]) => (
            <button
              key={code}
              onClick={() => {
                i18n.changeLanguage(code);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-sm transition-colors cursor-pointer
                ${currentLocale === code
                  ? "bg-violet/10 text-violet font-medium"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
