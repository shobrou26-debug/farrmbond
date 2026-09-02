import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  Loader2,
  Mail,
  Sprout,
  UserX,
} from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

// Honest capability highlights — each maps to a real FarmBond feature
const capabilityHighlights = [
  "AI-powered crop & livestock guidance",
  "Satellite monitoring & weather intelligence",
  "Finances, calendars & market insights",
  "All-in-one platform for modern farmers",
];

function friendlyAuthError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (msg.includes("not configured") || msg.includes("unavailable")) {
    return "Email service is temporarily unavailable. Please try again in a moment.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "Could not connect to the server. Please check your connection and try again.";
  }
  if (msg.includes("rate") || msg.includes("limit")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (msg.includes("invalid") || msg.includes("expired")) {
    return "The code is invalid or has expired. Please request a new one.";
  }
  return "Something went wrong. Please try again.";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, user, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);

  // Automatic 7-day Pro trial
  const trialStatus = useQuery(api.trials.getTrialStatus, isAuthenticated ? {} : "skip");
  const startTrial = useMutation(api.trials.startTrial);
  useEffect(() => {
    if (!isAuthenticated || !user || trialStatus === undefined) return;
    if (user.role === "admin" || user.role === "super_admin") return;
    if (!trialStatus.canStartTrial) return;
    startTrial().catch((err) => {
      console.warn("[Trial] Could not auto-start trial:", err instanceof Error ? err.message : err);
    });
  }, [isAuthenticated, user, trialStatus, startTrial]);

  const handleEmailSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
    } catch (error) {
      setError(friendlyAuthError(error));
    } finally {
      setIsLoading(false);
    }
  }, [signIn]);

  const handleOtpSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      navigate(redirect);
    } catch (error) {
      setError(friendlyAuthError(error));
      setOtp("");
    } finally {
      setIsLoading(false);
    }
  }, [signIn, navigate, redirect]);

  const handleGuestLogin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await signIn("anonymous");
      navigate(redirect);
    } catch (error) {
      setError(friendlyAuthError(error));
    } finally {
      setIsLoading(false);
    }
  }, [signIn, navigate, redirect]);

  const entrance = shouldReduceMotion
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ============================================================
          Left visual panel — agricultural branding (desktop only)
          ============================================================ */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col">
        <img
          src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1920&auto=format&fit=crop"
          alt="Lush green farmland stretching to the horizon"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-brand-deep/95 via-black/50 to-black/70" />

        <div className="relative z-10 flex h-full flex-col p-10 xl:p-14">
          {/* Brand */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            className="flex w-fit items-center gap-3"
            aria-label="FarmBond home"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-lg">
              <Sprout className="h-6 w-6 text-brand-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white">FarmBond</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/60">
                Smart Farming
              </span>
            </div>
          </a>

          {/* Value proposition */}
          <div className="flex flex-1 flex-col justify-center">
            <motion.div {...entrance} transition={{ duration: 0.5, delay: 0.1 }}>
              <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-brand/50 bg-black/25 px-4 py-1.5 text-sm font-medium text-brand backdrop-blur-sm">
                <span aria-hidden>◆</span>
                Future-Ready Farming
              </p>
              <h1 className="max-w-md text-4xl font-bold leading-[1.1] tracking-tight text-white xl:text-5xl">
                Grow smarter.
                <br />
                <span className="text-brand">Harvest more.</span>
              </h1>
              <p className="mt-5 max-w-md text-lg leading-relaxed text-white/80">
                Smart farming tools to help you grow better, reduce losses, and
                make better decisions.
              </p>
              <ul className="mt-8 space-y-3.5">
                {capabilityHighlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-3 text-sm text-white/85">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/25">
                      <Check className="h-3.5 w-3.5 text-brand" />
                    </span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          <p className="text-xs text-white/50">© 2026 FarmBond. All rights reserved.</p>
        </div>
      </div>

      {/* ============================================================
          Right auth column
          ============================================================ */}
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-soft/40 px-4 py-10 sm:px-6 lg:bg-background">
        {/* Mobile brand */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); navigate("/"); }}
          className="mb-8 flex flex-col items-center gap-3 lg:hidden"
          aria-label="FarmBond home"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand shadow-md">
            <Sprout className="h-7 w-7 text-brand-foreground" />
          </div>
          <div className="flex flex-col items-center">
            <span className="text-xl font-bold tracking-tight text-foreground">FarmBond</span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Smart Farming
            </span>
          </div>
        </a>

        <motion.div
          {...entrance}
          transition={{ duration: shouldReduceMotion ? 0 : 0.35 }}
          className="w-full max-w-md"
        >
          <Card className="w-full rounded-3xl border border-border/60 bg-card p-0 shadow-xl shadow-black/5">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center pt-8 pb-2">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-md">
                      <Sprout className="h-7 w-7 text-brand-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl tracking-tight">
                    Welcome to FarmBond
                  </CardTitle>
                  <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed">
                    Enter your email to get started. We'll send you a verification code.
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="pt-2 pb-4">
                    <div className="space-y-2">
                      <Label htmlFor="auth-email" className="text-sm font-medium">
                        Email address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="auth-email"
                          name="email"
                          placeholder="you@example.com"
                          type="email"
                          autoComplete="email"
                          className="h-12 rounded-xl pl-10"
                          disabled={isLoading}
                          required
                        />
                      </div>
                    </div>

                    {error && (
                      <p
                        role="alert"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
                      >
                        {error}
                      </p>
                    )}

                    <Button
                      type="submit"
                      className="mt-5 h-12 w-full rounded-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <div className="mt-6">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase tracking-wider">
                          <span className="bg-card px-3 text-muted-foreground">Or</span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-5 h-12 w-full rounded-full"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Continue as Guest
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center pt-8 pb-2">
                  <div className="flex justify-center mb-2">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand shadow-md">
                      <Sprout className="h-7 w-7 text-brand-foreground" />
                    </div>
                  </div>
                  <CardTitle className="text-2xl tracking-tight">Check your email</CardTitle>
                  <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed">
                    We've sent a 6-digit code to<br />
                    <span className="font-medium text-foreground">{step.email}</span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4 pt-2">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) form.requestSubmit();
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p
                        role="alert"
                        className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400"
                      >
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      Didn't receive a code?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0 font-semibold"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2 pb-6">
                    <Button
                      type="submit"
                      className="h-12 w-full rounded-full bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90 hover:shadow-lg hover:shadow-brand/25"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="h-12 w-full"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}
          </Card>
        </motion.div>

        {/* Legal links */}
        <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy Policy
          </Link>
          <span aria-hidden className="h-1 w-1 rounded-full bg-border" />
          <Link to="/terms" className="transition-colors hover:text-foreground">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
