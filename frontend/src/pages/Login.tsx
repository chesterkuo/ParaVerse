import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch {
      setError(t("auth.invalidCredentials"));
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
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-semibold">1</div>
              <span className="text-sm">{t("auth.brandFeature1")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-semibold">2</div>
              <span className="text-sm">{t("auth.brandFeature2")}</span>
            </div>
            <div className="flex items-center gap-3 text-white/60">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-semibold">3</div>
              <span className="text-sm">{t("auth.brandFeature3")}</span>
            </div>
          </div>
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

          <h2 className="text-xl font-semibold text-text-primary mb-1">{t("auth.welcomeBack")}</h2>
          <p className="text-sm text-text-secondary mb-6">{t("auth.signInSubtitle")}</p>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-text-primary mb-1.5">{t("auth.email")}</label>
              <input id="login-email" type="email" placeholder={t("auth.email")} value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted transition-colors" required />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-text-primary mb-1.5">{t("auth.password")}</label>
              <input id="login-password" type="password" placeholder={t("auth.password")} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-surface text-sm text-text-primary placeholder:text-text-muted transition-colors" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-violet text-white py-2.5 rounded-lg font-medium hover:bg-violet-light transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </form>

          <p className="text-sm text-center text-text-secondary mt-6">
            {t("auth.noAccount")}{" "}
            <Link to="/register" className="text-violet font-medium hover:text-violet-light transition-colors">{t("auth.createAccount")}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
