import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function Register() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(email, password, name);
      navigate("/");
    } catch {
      setError(t("auth.registrationFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy via-navy-light to-violet relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-violet rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-oasis rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <h1 className="text-4xl font-bold mb-4">{t("common.appName")}</h1>
          <p className="text-lg text-white/70 leading-relaxed max-w-md">
            {t("auth.brandDescription")}
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center bg-bg px-6 relative">
        <div className="absolute top-4 right-4">
          <LanguageSwitcher />
        </div>
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h1 className="text-2xl font-bold text-navy">{t("common.appName")}</h1>
            <p className="text-sm text-text-secondary mt-1">{t("common.tagline")}</p>
          </div>

          <h2 className="text-xl font-semibold text-text-primary mb-1">{t("auth.createYourAccount")}</h2>
          <p className="text-sm text-text-secondary mb-6">{t("auth.getStarted")}</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-text-primary mb-1.5">{t("auth.name")}</label>
              <input id="reg-name" type="text" placeholder={t("auth.name")} value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted transition-colors" required />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-text-primary mb-1.5">{t("auth.email")}</label>
              <input id="reg-email" type="email" placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted transition-colors" required />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-text-primary mb-1.5">{t("auth.password")}</label>
              <input id="reg-password" type="password" placeholder={t("auth.passwordHint")} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted transition-colors" required minLength={8} />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-violet text-white py-2.5 rounded-lg font-medium hover:bg-violet-light transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t("auth.creatingAccount") : t("auth.createAccount")}
            </button>
          </form>

          <p className="text-sm text-center text-text-secondary mt-6">
            {t("auth.haveAccount")}{" "}
            <Link to="/login" className="text-violet font-medium hover:text-violet-light transition-colors">{t("auth.signIn")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
