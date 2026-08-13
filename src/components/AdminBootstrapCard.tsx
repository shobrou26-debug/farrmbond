import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2 } from "lucide-react";

/**
 * First-admin bootstrap card.
 *
 * Shown ONLY when the server reports that initial admin setup is
 * configured (BOOTSTRAP_ADMIN_EMAIL set) AND no admin exists yet. The
 * server enforces that the signed-in account's email matches the
 * configured bootstrap email — a mismatched account gets an error, and
 * the mutation is permanently inert once any admin exists.
 *
 * Renders nothing in every other case, so regular users never see it.
 */
export function AdminBootstrapCard() {
  const status = useQuery(api.adminBootstrap.getAdminBootstrapStatus);
  const bootstrapFirstAdmin = useMutation(api.adminBootstrap.bootstrapFirstAdmin);
  const [isClaiming, setIsClaiming] = useState(false);

  if (status === undefined || !status.canShowCard) {
    return null;
  }

  const handleClaim = async () => {
    setIsClaiming(true);
    try {
      await bootstrapFirstAdmin();
      toast.success("Initial admin access granted. Welcome, administrator!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to claim initial admin access."
      );
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-emerald-500/5 mb-5 sm:mb-6">
      <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 shrink-0">
          <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Initial admin setup</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            No administrator exists on this deployment yet. If the signed-in
            account matches the configured <span className="font-mono text-foreground/70">BOOTSTRAP_ADMIN_EMAIL</span>,
            you can claim the initial admin role here. Anyone else is denied
            server-side, and this option closes permanently once an admin exists.
          </p>
        </div>
        <Button
          onClick={handleClaim}
          disabled={isClaiming}
          className="gradient-primary shrink-0"
        >
          {isClaiming ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Claim initial admin access
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
