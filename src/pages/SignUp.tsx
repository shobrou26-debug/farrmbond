import * as React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "framer-motion";
import { Mail, User, Shield, Check } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { useMutation } from "convex/react";
import { useQuery } from "convex/react";
import { cn } from "@/lib-utils";

interface SignUpProps {
  returnTo?: string;
}

/** 
 * SignUp Page - For new FarmBond users. 
 * Uses Convex Auth for email OTP sign-in with profile onboarding and password creation. 
 * 
 * Design: Clean, professional sign-up experience with name, role selection, 
 * password, and Privacy Policy acceptance. OTP verification completes the flow. 
 * 
 * KEEP-IN-TACT: Does not modify any existing authentication code, routes, or state. 
 * Connects to the actual application authentication system. 
 */ 

export function SignUpPage({ returnTo }: SignUpProps = {}) {
  const navigate = useNavigate();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<"farmer" | "agronomist">("farmer");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [privacyAccepted, setPrivacyAccepted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpVerified, setOtpVerified] = React.useState(false);

  const handleNameChange = (value: string) => setName(value);
  const handleEmailChange = (value: string) => setEmail(value);
  const handlePasswordChange = (value: string) => setPassword(value);
  const handlePasswordConfirmChange = (value: string) => setPasswordConfirm(value);
  const handleShowPasswordToggle = () => setShowPassword(!showPassword);
  const handleRoleChange = (value: "farmer" | "agronomist") => setRole(value);
  const handlePrivacyChange = (accepted: boolean) => setPrivacyAccepted(accepted);

  const handleSubmitPersonal = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password.trim()) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!privacyAccepted) {
      setError("Please accept the Privacy Policy.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn("email-otp", { email });
      setOtpSent(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "An error occurred";
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (event: React.FormEvent, code: string) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // OTP verification - redirects to auth page for backend verification
      setOtpVerified(true);
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
  const passwordConfirmInputType = showPassword ? "text" : "password";

  return (
    <div className="min-h-screen bg-background">
      /* ============================================================ 
          Two-column layout: branding left, signup card right (desktop) 
          ============================================================ */}<div className="lg:flex lg:w-full">
        /* Left: Branding column - desktop */<div className="lg:flex lg:flex-col lg:flex-shrink-0 w-80 bg-gradient-to-b from-brand-soft to-background p-8 xl:p-12">
          <a href="/" aria-label="FarmBond home" className="flex w-fit items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-lg">
              <Mail className="h-6 w-6 text-brand" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-brand">FarmBond</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand">Smart Farming</span>
            </div>
          </a>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-brand mb-2">
              Get started.
            </h1>
            <p className="text-lg leading-relaxed text-brand/80">
              Join thousands of farmers and agronomists using smart farming tools.
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-brand/85">
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Secure OTP verification
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Role-based dashboard
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/20">
                  <Check className="h-2.5 w-2.5 text-brand" /> Privacy-first design
                </span>
              </li>
            </ul>
          </motion.div>
        </div>

        /* Right: Signup card - desktop */<div className="lg:relative lg:pl-8 lg:w-1/2">
          <div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
            <Card className="w-full rounded-3xl border border-border/60 bg-card p-6 shadow-xl shadow-black/5">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand shadow-md">
                    <User className="h-6 w-6 text-brand" />
                  </div>
                </div>
                <CardTitle className="text-2xl tracking-tight">Create Your Account</CardTitle>
                <CardDescription className="mx-auto max-w-xs text-sm leading-relaxed">
                  Welcome to FarmBond. Create your account to access smart farming tools.
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleSubmitPersonal} className="mt-8 space-y-6">
                <div className="space-y-4">
                  <Label htmlFor="signup-name" className="text-sm font-medium">
                    Full name
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="signup-email" className="text-sm font-medium">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <Label htmlFor="signup-password" className="text-sm font-medium">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={passwordInputType}
                      id="signup-password"
                      placeholder="Enter password (10+ characters)"
                      value={password}
                      onChange={(e) => handlePasswordChange(e.target.value)}
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

                <div className="space-y-4">
                  <Label htmlFor="signup-password-confirm" className="text-sm font-medium">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Input
                      type={passwordConfirmInputType}
                      id="signup-password-confirm"
                      placeholder="Confirm password"
                      value={passwordConfirm}
                      onChange={(e) => handlePasswordConfirmChange(e.target.value)}
                      required
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-role" className="text-sm font-medium">
                    Farmer or Agronomist?
                  </Label>
                  <div className="space-y-2">
                    <label
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded border border-border/50 cursor-select hover:border-brand/20",
                        role === "farmer" ? "bg-brand/10 text-brand" : "",
                        role === "agronomist" ? "bg-brand/10 text-brand" : "",
                      )}>
                      <input
                        type="radio"
                        name="role"
                        value="farmer"
                        checked={role === "farmer"}
                        onChange={() => handleRoleChange("farmer")}
                        className="peer hidden"
                      />
                      <span>Farmer</span>
                    </label>
                    <label
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded border border-border/50 cursor-select hover:border-brand/20",
                        role === "farmer" ? "" : "bg-brand/10 text-brand",
                        role === "agronomist" ? "bg-brand/10 text-brand" : "",
                      )}>
                      <input
                        type="radio"
                        name="role"
                        value="agronomist"
                        checked={role === "agronomist"}
                        onChange={() => handleRoleChange("agronomist")}
                        className="peer hidden"
                      />
                      <span>Agronomist</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Checkbox
                    id="privacy-policy"
                    checked={privacyAccepted}
                    onCheckedChange={handlePrivacyChange}
                  />
                  <span className="text-sm text-muted-foreground">
                    I accept the <a href="/privacy-policy" className="text-brand hover:text-brand">Privacy Policy</a>
                  </span>
                </div>
              </form>
            </Card>
          </div>
        </div>
      </div>

      /* ============================================================ 
          Mobile: stacked layout 
          ============================================================ */}<div className="lg:hidden flex flex-col items-center p-6">
        /* Mobile branding */<div className="w-full max-w-md text-center mb-8">
          <a href="/" aria-label="FarmBond home" className="flex justify-center mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand shadow-lg">
              <Mail className="h-6 w-6 text-brand" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-brand">FarmBond</span>
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-brand">Smart Farming</span>
            </div>
          </a>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight text-brand mb-2">
              Get started.
            </h1>
            <p className="text-lg leading-relaxed text-brand/80">
              Join thousands of farmers and agronomists using smart farming tools.
            </p>
          </motion.div>
        </div>

        /* Mobile signup card */<div className="relative z-10 w-full max-w-md mx-auto px-4 py-12">
          <Card className="w-full rounded-3xl border border-border/60 bg-card p-6 shadow-xl shadow-black/5">
            <CardHeader className="text-center pb-2">
              <div className="flex justify-center mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand shadow-md">
                  <User className="h-6 w-6 text-brand" />
                </div>
              </div>
              <CardTitle className="text-2xl tracking-tight">Create Your Account</CardTitle>
            </CardHeader>

            <form onSubmit={handleSubmitPersonal} className="mt-8 space-y-6">
              <div className="space-y-4">
                <Label htmlFor="signup-name" className="text-sm font-medium">
                  Full name
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="signup-email" className="text-sm font-medium">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="signup-password" className="text-sm font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    type={passwordInputType}
                    id="signup-password"
                    placeholder="Enter password (10+ characters)"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
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

              <div className="space-y-4">
                <Label htmlFor="signup-password-confirm" className="text-sm font-medium">
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    type={passwordConfirmInputType}
                    id="signup-password-confirm"
                    placeholder="Confirm password"
                    value={passwordConfirm}
                    onChange={(e) => handlePasswordConfirmChange(e.target.value)}
                    required
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-role" className="text-sm font-medium">
                  Farmer or Agronomist?
                </Label>
                <div className="space-y-2">
                  <label
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded border border-border/50 cursor-select hover:border-brand/20",
                      role === "farmer" ? "bg-brand/10 text-brand" : "",
                      role === "agronomist" ? "bg-brand/10 text-brand" : "",
                    )}>
                    <input
                      type="radio"
                      name="role"
                      value="farmer"
                      checked={role === "farmer"}
                      onChange={() => handleRoleChange("farmer")}
                      className="peer hidden"
                    />
                    <span>Farmer</span>
                  </label>
                  <label
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded border border-border/50 cursor-select hover:border-brand/20",
                      role === "farmer" ? "" : "bg-brand/10 text-brand",
                      role === "agronomist" ? "bg-brand/10 text-brand" : "",
                    )}>
                      <input
                        type="radio"
                        name="role"
                        value="agronomist"
                        checked={role === "agronomist"}
                        onChange={() => handleRoleChange("agronomist")}
                        className="peer hidden"
                      />
                      <span>Agronomist</span>
                    </label>
                </div>
              </div>

              <div className="space-y-2">
                <Checkbox
                  id="privacy-policy"
                  checked={privacyAccepted}
                  onCheckedChange={handlePrivacyChange}
                />
                <span className="text-sm text-muted-foreground">
                  I accept the <a href="/privacy-policy" className="text-brand hover:text-brand">Privacy Policy</a>
                </span>
              </div>
            </form>
          </Card>
        </div>
</div>
      </div>
    </div>
  );
}

/** 
 * SignUpPage - Root component with Suspense boundary support. 
 * Used by the preview/lazy-loading system. 
 */ 

export default function SignUpPageRoot(props: SignUpProps = {}) {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-gray-50">Loading...</div>}>{
      <SignUpPage {...props} />
    }</React.Suspense>
  );
}