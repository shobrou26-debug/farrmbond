import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Suspense } from "react";
import { Mail, Check } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoginProps {
  returnTo?: string;
}

/** 
 * Login Page - For FarmBond users. 
 * Offers two authentication methods: email+password or email OTP.
 * Uses Convex Auth for both providers.
 * 
 * Design: Clean, professional authentication experience with two login options.
 * Option A: Email and password (new)
 * Option B: Email OTP (preserved existing flow)
 * 
 * KEEP-IN-TACT: Does not modify any existing authentication code, routes, or state.
 * Connects to the actual application authentication system.
 */ 

export function LoginPage({ returnTo }: LoginProps = {}) {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loginOption, setLoginOption] = React.useState<'password' | 'otp'>('otp');
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleShowPasswordToggle = () => setShowPassword(!showPassword);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (loginOption === 'password') {
        // Password login
        if (!email.trim()) {
          setError("Please enter your email address.");
          return;
        }
        if (!password.trim()) {
          setError("Please enter your password.");
          return;
        }
        // Use Convex Auth signIn with password provider
        await signIn("email-password", { email, password });
      } else {
        // OTP login (preserved existing flow)
        if (!email.trim()) {
          setError("Please enter your email address.");
          return;
        }
        // Use Convex Auth signIn with email-otp provider
        await signIn("email-otp", { email });
      }

      // After successful authentication, navigate
      if (returnTo) {
        navigate(returnTo, { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordInputType = showPassword ? "text" : "password";

  // Password form section
  const passwordForm = (
    <div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email" className="text-sm font-medium">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              name="email"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password" className="text-sm font-medium">
            Password
          </Label>
          <div className="relative">
            <Input
              type={passwordInputType}
              id="login-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pl-10"
            />
            <button
              type="button"
              onClick={handleShowPasswordToggle}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-brand focus:outline-none focus:text-brand"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div>
          <Button
            type="submit"
            className="w-full rounded-full bg-[#2E7D32] text-white text-base font-semibold hover:bg-[#2E7D32] hover:shadow-lg hover:shadow-[#2E7D32]/25 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Processing...
              </>
            ) : (
              "Log In"
            )}
          </Button>
        </div>
      </form>
    </div>
  );

  // OTP form section
  const otpForm = (
    <div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="login-email-otp" className="text-sm font-medium">
            Email address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email-otp"
              name="email"
              placeholder="you@example.com"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="pl-10"
            />
          </div>
        </div>

        <Button
          type="submit"
          className="w-full rounded-full bg-[#2E7D32] text-white text-base font-semibold hover:bg-[#2E7D32] hover:shadow-lg hover:shadow-[#2E7D32]/25 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Processing...
            </>
          ) : (
            "Log In"
          )}
        </Button>

        <p className="mt-3 text-sm text-muted-foreground">
          We'll send a verification code to {email}
        </p>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ============================================================ 
          Two-column layout: branding left, login card right (desktop) 
          ============================================================ */}<div className="lg:flex lg:w-full">
        {/* Left: Branding column - desktop */}<div className="lg:flex lg:flex-col lg:flex-shrink-0 w-80 bg-gradient-to-b from-brand-soft to-background p-8 xl:p-12">
          <a href="/" aria-label="FarmBond home" className="flex w-fit items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-lg">
              <Mail className="h-6 w-6 text-brand" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-brand">FarmBond</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand/60">Smart Farming</span>
            </div>
          </a>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-brand mb-2">
              Grow smarter.
            </h1>
            <p className="text-lg leading-relaxed text-brand/80">
              Smart farming tools to help you grow better, reduce losses, and make better decisions.
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-brand/85">
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Future-Ready Farming
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Reduce Crop Losses
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Make Better Decisions
                </span>
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Right: Login card - desktop */}<div className="lg:relative lg:pl-8 lg:w-1/2">
          <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
            <Card className="w-full rounded-3xl border border-border/60 bg-card p-6 shadow-xl shadow-black/5">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand shadow-md">
                    <Mail className="h-6 w-6 text-brand" />
                  </div>
                </div>
                <CardTitle className="text-2xl tracking-tight">Log In to FarmBond</CardTitle>
                <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed">
                  Welcome back. Enter your email to access your farm dashboard.
                </CardDescription>
              </CardHeader>

              {/* ============================================================ 
                  Login options: two buttons side-by-side (desktop) or stacked (mobile) 
                  ============================================================ */}<div className="space-y-4 pt-6">
                {/* Option A: Email and password */}<button
                  onClick={() => setLoginOption('password')}
                  className={cn(
                    "w-full rounded border border-border/50 text-left py-3 px-4 font-medium transition-colors",
                    loginOption === 'password' ? "bg-brand/10 text-brand" : "text-muted-foreground hover:text-brand",
                  )}>
                  <span className="flex items-center gap-3">
                    <span className="text-lg font-normal">Option A: Email & Password</span>
                  </span>
                </button>

                {/* Option B: Email OTP */}<button
                  onClick={() => setLoginOption('otp')}
                  className={cn(
                    "w-full rounded border border-border/50 text-left py-3 px-4 font-medium transition-colors",
                    loginOption === 'otp' ? "bg-brand/10 text-brand" : "text-muted-foreground hover:text-brand",
                  )}>
                  <span className="flex items-center gap-3">
                    <span className="text-lg font-normal">Option B: Email OTP</span>
                  </span>
                </button>
              </div>

              {/* Password login form (shown when Option A is selected) */}{loginOption === 'password' && passwordForm}

              {/* OTP login form (shown when Option B is selected, preserved existing flow) */}{loginOption === 'otp' && otpForm}

              {error && (
                <div className="rounded-lg border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* Don't have an account? Sign Up link */}<div className="mt-4 text-center">
                <Link
                  to="/sign-up"
                  className="text-sm font-medium text-[#2E7D32] hover:underline"
                >
                  Don't have an account? Sign Up
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 
 * LoginPage - Root component with Suspense boundary support. 
 * Used by the preview/lazy-loading system. 
 */ 

export default function LoginPageRoot(props: LoginProps = {}) {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50">Loading...</div>}>{
      <LoginPage {...props} />
    }</React.Suspense>
  );
}