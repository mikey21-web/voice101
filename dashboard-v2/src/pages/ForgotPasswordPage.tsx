import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { useBranding } from "../lib/useBranding";
import BrandLogo from "../components/BrandLogo";
import { api } from "../lib/api";

export function ForgotPasswordPage() {
  const branding = useBranding();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      await api("/auth/forgot", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        msg.includes("network") ||
        msg.includes("fetch") ||
        msg.includes("NetworkError") ||
        msg.includes("Failed to fetch")
      ) {
        setError("Network error. Please check your connection.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <div className="flex flex-1 items-center justify-center px-8 py-12 lg:px-16">
        <div className="w-full max-w-sm">
          <div className="mb-12">
            <div className="flex items-center gap-2.5 mb-10">
              <BrandLogo
                logoUrl={branding.logoUrl}
                name={branding.businessName || "LeadAuto"}
                className="h-9 rounded-lg"
                initialsClassName="h-9 w-9 rounded-lg bg-[var(--primary)] flex items-center justify-center"
              />
              <span className="text-base font-bold text-[var(--foreground)]">
                {branding.businessName || "LeadAuto"}
              </span>
            </div>

            {!submitted ? (
              <>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                  Forgot password?
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
                  No worries. Enter your email and we'll send you a reset link.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-[var(--foreground)]">
                  Check your email
                </h1>
                <p className="text-sm text-[var(--muted-foreground)] mt-1.5">
                  If an account exists with that email, we've sent a password
                  reset link.
                </p>
              </>
            )}
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-[var(--foreground)]">
                  Email
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  autoComplete="email"
                  autoFocus
                  className="flex h-10 w-full rounded-lg border border-[var(--input)] bg-[var(--card)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/20 focus:border-[var(--ring)] transition-all"
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400 animate-fade-in">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                loading={loading}
                className="w-full h-10"
              >
                {loading ? "Sending..." : "Send reset link"}
              </Button>

              <p className="text-center text-sm text-[var(--muted-foreground)]">
                <Link
                  to="/login"
                  className="hover:text-[var(--primary)] underline underline-offset-4 transition-colors"
                >
                  Back to login
                </Link>
              </p>
            </form>
          ) : (
            <p className="text-center text-sm text-[var(--muted-foreground)]">
              <Link
                to="/login"
                className="hover:text-[var(--primary)] underline underline-offset-4 transition-colors"
              >
                Back to login
              </Link>
            </p>
          )}
        </div>
      </div>

      <div className="hidden lg:flex lg:w-[45%] bg-[var(--primary)] relative items-center justify-center p-12 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 25%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative max-w-md text-white">
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight">
            AI-powered
            <br />
            lead conversion
          </h2>
          <p className="mt-4 text-white/70 leading-relaxed text-sm max-w-sm">
            Capture, nurture, and convert leads automatically with intelligent
            conversations across WhatsApp, email, and web.
          </p>
          <div className="mt-10 space-y-5">
            {[
              { stat: "24×7", label: "AI Lead Engagement" },
              { stat: "85%", label: "Avg. Response Rate" },
              { stat: "3x", label: "More Bookings" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <div className="h-px w-6 bg-white/30" />
                <span className="text-xl font-bold tracking-tight">
                  {item.stat}
                </span>
                <span className="text-white/60 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 pt-6 border-t border-white/[0.12]">
            <p className="text-xs text-white/50">Trusted by 500+ businesses</p>
          </div>
        </div>
      </div>
    </div>
  );
}
