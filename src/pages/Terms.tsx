import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sprout,
  Shield,
  ArrowLeft,
  ChevronRight,
  Calendar,
  Globe,
  Mail,
  FileText,
  Users,
  CreditCard,
  Scale,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Ban,
  Gavel,
  ShieldCheck,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Table of Contents
// ============================================================

const tableOfContents = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "eligibility", label: "Eligibility" },
  { id: "account", label: "Account Registration" },
  { id: "subscriptions", label: "Subscriptions & Payments" },
  { id: "user-obligations", label: "User Obligations" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "user-content", label: "User-Generated Content" },
  { id: "ai-services", label: "AI Services & Disclaimers" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "termination", label: "Termination" },
  { id: "liability", label: "Limitation of Liability" },
  { id: "indemnification", label: "Indemnification" },
  { id: "dispute-resolution", label: "Dispute Resolution" },
  { id: "governing-law", label: "Governing Law" },
  { id: "changes", label: "Changes to Terms" },
  { id: "contact", label: "Contact Us" },
];

// ============================================================
// Section Component
// ============================================================

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <motion.section id={id} variants={itemVariants} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-4">
        {children}
      </div>
    </motion.section>
  );
}

// ============================================================
// Main Terms of Service Page
// ============================================================

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-md group-hover:shadow-lg transition-shadow">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient-primary">
              FarmBond
            </span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-12 md:py-16">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-12"
        >
          {/* Page Header */}
          <motion.div variants={itemVariants} className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-4">
              <Scale className="w-3.5 h-3.5 mr-1.5" />
              Legal
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Terms of Service
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Please read these terms carefully before using FarmBond. By accessing or using our
              platform, you agree to be bound by these Terms of Service.
            </p>
            <div className="flex items-center justify-center gap-4 mt-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                Effective: January 1, 2026
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Version 1.0
              </span>
            </div>
          </motion.div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8 lg:gap-12">
            {/* Table of Contents */}
            <motion.aside variants={itemVariants} className="hidden lg:block">
              <div className="sticky top-24 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  On this page
                </p>
                {tableOfContents.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-lg hover:bg-muted/50"
                  >
                    <ChevronRight className="w-3 h-3 shrink-0" />
                    {item.label}
                  </a>
                ))}
              </div>
            </motion.aside>

            {/* Main Content */}
            <div className="space-y-12">
              {/* Introduction */}
              <motion.div variants={itemVariants} className="p-6 rounded-2xl bg-muted/30 border border-border/50">
                <p className="text-sm leading-relaxed">
                  These Terms of Service ("Terms") govern your access to and use of the FarmBond
                  platform, including our website, mobile applications, APIs, and related services
                  (collectively, the "Service"). These Terms form a legally binding agreement
                  between you ("User," "you," or "your") and FarmBond Inc. ("FarmBond," "we,"
                  "our," or "us").
                </p>
              </motion.div>

              {/* Section 1: Acceptance */}
              <Section id="acceptance" title="1. Acceptance of Terms" icon={BookOpen}>
                <p>
                  By creating an account, accessing, or using the Service, you acknowledge that
                  you have read, understood, and agree to be bound by these Terms and our{" "}
                  <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                  If you do not agree to these Terms, you must not access or use the Service.
                </p>
                <p>
                  We may update these Terms from time to time. Material changes will be
                  communicated via email or in-app notification at least 30 days before they
                  take effect. Your continued use of the Service after the effective date of
                  any changes constitutes acceptance of the updated Terms.
                </p>
              </Section>

              {/* Section 2: Eligibility */}
              <Section id="eligibility" title="2. Eligibility" icon={Users}>
                <p>To use the Service, you must:</p>                <ul className="list-disc pl-5 space-y-2">
                  <li>Be at least 16 years of age (or the minimum age required in your jurisdiction)</li>
                  <li>Have the legal capacity to enter into binding agreements</li>
                  <li>Not be barred from using the Service under applicable law</li>
                  <li>Provide accurate and complete registration information</li>
                </ul>
                <p>
                  If you are using the Service on behalf of an organization, you represent and
                  warrant that you have the authority to bind that organization to these Terms.
                </p>
              </Section>

              {/* Section 3: Account */}
              <Section id="account" title="3. Account Registration & Security" icon={ShieldCheck}>
                <h3 className="text-base font-semibold text-foreground">Account Creation</h3>
                <p>
                  To access certain features, you must create an account by providing accurate
                  information including your name, email address, and role (Farmer, Agronomist,
                  or Administrator). You are responsible for maintaining the confidentiality of
                  your account credentials.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">Account Security</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You are responsible for all activity that occurs under your account</li>
                  <li>You must notify us immediately of any unauthorized use of your account</li>
                  <li>We reserve to suspend or terminate accounts that show signs of compromise</li>
                  <li>You may not share your account credentials with third parties</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Account Roles</h3>
                <p>FarmBond supports multiple user roles with different permissions:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Farmer:</strong> Full access to farm management tools, AI assistant, and analytics</li>
                  <li><strong>Agronomist:</strong> Professional profile, consultation booking, and client management</li>
                  <li><strong>Administrator:</strong> Platform management, user administration, and system settings</li>
                </ul>
              </Section>

              {/* Section 4: Subscriptions */}
              <Section id="subscriptions" title="4. Subscriptions & Payments" icon={CreditCard}>
                <h3 className="text-base font-semibold text-foreground">Subscription Plans</h3>
                <p>FarmBond offers the following subscription tiers:</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  {[
                    { plan: "Free", price: "$0/forever", features: "1 farm, 5 crops, basic weather, limited AI" },
                    { plan: "Pro", price: "$29/month", features: "Unlimited farms, crops, AI, satellite, analytics" },
                    { plan: "Enterprise", price: "$99/month", features: "Everything in Pro + API, custom integrations, SLA" },
                  ].map((item, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-sm font-semibold">{item.plan}</p>
                      <p className="text-lg font-bold text-primary">{item.price}</p>                      <p className="text-xs text-muted-foreground mt-1">{item.features}</p>
                    </div>
                  ))}
                </div>

                <h3 className="text-base font-semibold text-foreground mt-6">Payment Terms</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Payments are processed securely via Stripe, PayPal, MTN Mobile Money, or Airtel Money</li>
                  <li>Subscriptions renew automatically unless cancelled at least 24 hours before renewal</li>
                  <li>All fees are non-refundable except as required by applicable law</li>
                  <li>We reserve the right to change pricing with 30 days' notice</li>
                  <li>Failed payments may result in account suspension after a 7-day grace period</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Cancellation</h3>                <p>
                  You may cancel your subscription at any time through your account settings.
                  Cancellation takes effect at the end of the current billing period. You will
                  retain access to paid features until that date.
                </p>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>Refund Policy:</strong> We offer a 14-day money-back guarantee for
                      new Pro and Enterprise subscriptions. Contact support@farmbond.com to
                      request a refund within this period.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Section 5: User Obligations */}
              <Section id="user-obligations" title="5. User Obligations" icon={CheckCircle2}>
                <p>You agree to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Use the Service only for lawful purposes and in accordance with these Terms</li>
                  <li>Provide accurate and up-to-date information about your farms and operations</li>
                  <li>Maintain the security of your account and notify us of any breaches</li>
                  <li>Not use the Service to engage in any fraudulent, deceptive, or harmful activity</li>
                  <li>Not attempt to gain unauthorized access to any part of the Service</li>
                  <li>Not interfere with or disrupt the Service or servers connected to the Service</li>
                  <li>Not use automated systems (bots, scrapers) to access the Service without permission</li>
                  <li>Comply with all applicable local, state, national, and international laws</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Prohibited Activities</h3>
                <p>You must not:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Remove, alter, or obscure any proprietary notices or labels</li>
                  <li>Use the Service to build a competing product or service</li>
                  <li>Resell, sublicense, or distribute the Service without our written consent</li>
                  <li>Use AI-generated content from the Service to train competing AI models</li>
                </ul>
              </Section>

              {/* Section 6: Intellectual Property */}
              <Section id="intellectual-property" title="6. Intellectual Property" icon={FileText}>
                <h3 className="text-base font-semibold text-foreground">FarmBond's IP</h3>
                <p>
                  The Service, including its design, code, features, content, trademarks, and
                  logos, is owned by FarmBond and protected by intellectual property laws. You
                  receive a limited, non-exclusive, non-transferable license to use the Service
                  in accordance with these Terms.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">Your IP</h3>
                <p>
                  You retain all rights to your farm data, uploaded images, and content you
                  create on the platform. By using the Service, you grant us a limited license
                  to process this data solely for the purpose of providing the Service to you.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">AI-Generated Content</h3>
                <p>
                  Content generated by our AI assistant (recommendations, predictions, analysis)
                  is provided for informational purposes. You may use this content for your
                  farming operations, but we make no guarantees about its accuracy or
                  suitability for any particular purpose.
                </p>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mt-4">
                  <p className="text-sm">
                    <strong>Data Ownership:</strong> Your farm data belongs to you. We will never
                    sell your individual farm data to third parties. Aggregated and anonymized
                    data may be used to improve our services and AI models.
                  </p>
                </div>
              </Section>

              {/* Section 7: User Content */}
              <Section id="user-content" title="7. User-Generated Content" icon={Users}>
                <p>
                  You may post content to community forums, share knowledge articles, or
                  contribute to discussions. By posting content, you represent and warrant that:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>You own or have the right to post the content</li>
                  <li>The content does not violate any law or third-party rights</li>
                  <li>The content is not harmful, abusive, or misleading</li>
                </ul>
                <p>
                  We reserve the right to remove content that violates these Terms or is
                  reported by other users. We may also use content you post to improve the
                  Service, but you retain ownership of your original content.
                </p>
              </Section>

              {/* Section 8: AI Services */}
              <Section id="ai-services" title="8. AI Services & Disclaimers" icon={Shield}>
                <p>
                  FarmBond provides AI-powered features including crop recommendations, disease
                  detection, weather analysis, and yield predictions. These features are subject
                  to the following disclaimers:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Not Professional Advice:</strong> AI recommendations are not a substitute for professional agronomic, financial, or legal advice</li>
                  <li><strong>No Guarantees:</strong> We do not guarantee the accuracy, completeness, or reliability of AI-generated content</li>
                  <li><strong>Limitation of Liability:</strong> You use AI recommendations at your own risk. FarmBond is not liable for any losses resulting from reliance on AI outputs</li>
                  <li><strong>Human Oversight:</strong> We recommend consulting qualified professionals before making significant farming decisions based on AI recommendations</li>
                </ul>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>Important:</strong> AI disease detection is for informational
                      purposes only. Always verify diagnoses with a qualified agronomist or
                      agricultural extension officer before applying treatments.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Section 9: Third-Party Services */}
              <Section id="third-party" title="9. Third-Party Services" icon={Globe}>
                <p>
                  The Service integrates with third-party services including:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Weather:</strong> Open-Meteo API for weather data</li>
                  <li><strong>Satellite:</strong> ESA Copernicus Sentinel-2 for NDVI analysis</li>
                  <li><strong>Payments:</strong> Stripe, PayPal, MTN Mobile Money, Airtel Money</li>
                  <li><strong>AI:</strong> OpenAI API for natural language processing</li>
                </ul>
                <p>
                  Your use of third-party services is subject to their respective terms and
                  privacy policies. We are not responsible for the practices of third-party
                  service providers.
                </p>
              </Section>

              {/* Section 10: Termination */}
              <Section id="termination" title="10. Termination" icon={Ban}>
                <h3 className="text-base font-semibold text-foreground">By You</h3>
                <p>
                  You may terminate your account at any time by contacting support or using
                  the account deletion feature in your settings. Upon termination, your right
                  to use the Service ceases immediately.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">By Us</h3>
                <p>We may suspend or terminate your account if:</p>                <ul className="list-disc pl-5 space-y-2">
                  <li>You violate these Terms or any applicable law</li>
                  <li>Your payment method fails and is not updated within 7 days</li>
                  <li>We are required to do so by law</li>
                  <li>We reasonably believe your use poses a security risk</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Effect of Termination</h3>                <p>
                  Upon termination, your data will be retained for 30 days to allow for data
                  export, after which it will be permanently deleted. You may request early
                  data deletion by contacting privacy@farmbond.com.
                </p>
              </Section>

              {/* Section 11: Limitation of Liability */}
              <Section id="liability" title="11. Limitation of Liability" icon={Scale}>
                <p>
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, FARMBOND SHALL NOT BE LIABLE FOR ANY
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
                  BUT NOT LIMITED TO:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Loss of profits, data, use, or goodwill</li>
                  <li>Agricultural losses resulting from reliance on AI recommendations</li>
                  <li>Damages arising from third-party services or content</li>
                  <li>Any unauthorized access to or alteration of your data</li>
                </ul>
                <p>
                  Our total liability for any claim arising from or related to the Service
                  shall not exceed the greater of: (a) the amount you paid us in the 12 months
                  preceding the claim, or (b) $100 USD.
                </p>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50 mt-4">
                  <p className="text-sm">
                    <strong>Essential Purpose:</strong> These limitations apply even if we have
                    been advised of the possibility of such damages. Some jurisdictions do not
                    allow certain limitations of liability, so some of the above may not apply
                    to you.
                  </p>
                </div>
              </Section>

              {/* Section 12: Indemnification */}
              <Section id="indemnification" title="12. Indemnification" icon={ShieldCheck}>
                <p>
                  You agree to indemnify, defend, and hold harmless FarmBond and its officers,
                  directors, employees, and agents from any claims, damages, losses, or expenses
                  arising from:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Your use of the Service</li>
                  <li>Your violation of these Terms</li>
                  <li>Your violation of any law or third-party rights</li>
                  <li>Content you post or share through the Service</li>
                  <li>Your agricultural operations and decisions</li>
                </ul>
              </Section>

              {/* Section 13: Dispute Resolution */}
              <Section id="dispute-resolution" title="13. Dispute Resolution" icon={Gavel}>
                <h3 className="text-base font-semibold text-foreground">Informal Resolution</h3>
                <p>
                  Before filing a formal claim, you agree to contact us at
                  legal@farmbond.com and attempt to resolve the dispute informally for
                  at least 30 days.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">Binding Arbitration</h3>
                <p>
                  Any dispute not resolved informally shall be resolved through binding
                  arbitration administered by the American Arbitration Association (AAA) under
                  its Commercial Arbitration Rules. The arbitration shall be conducted in
                  English in Nairobi, Kenya, or remotely as agreed by the parties.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">Class Action Waiver</h3>
                <p>
                  You agree that any dispute resolution proceedings will be conducted only on
                  an individual basis and not in a class, consolidated, or representative action.
                </p>

                <h3 className="text-base font-semibold text-foreground mt-6">Exceptions</h3>
                <p>
                  Notwithstanding the above, either party may seek injunctive or other equitable
                  relief in any court of competent jurisdiction to prevent the actual or
                  threatened infringement or misappropriation of intellectual property rights.
                </p>
              </Section>

              {/* Section 14: Governing Law */}
              <Section id="governing-law" title="14. Governing Law" icon={Globe}>
                <p>
                  These Terms shall be governed by and construed in accordance with the laws
                  of the Republic of Kenya, without regard to its conflict of law provisions.
                  Any legal proceedings shall be brought exclusively in the courts of Nairobi,
                  Kenya, unless otherwise specified in the arbitration clause above.
                </p>
              </Section>

              {/* Section 15: Changes */}
              <Section id="changes" title="15. Changes to Terms" icon={FileText}>
                <p>
                  We reserve the right to modify these Terms at any time. Material changes
                  will be communicated via:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Email notification to registered users</li>
                  <li>In-app notification with a summary of changes</li>
                  <li>Updated "Effective" date on this page</li>
                </ul>
                <p>
                  Your continued use of the Service after changes take effect constitutes
                  acceptance of the new Terms. If you do not agree to the changes, you must
                  stop using the Service and contact us to close your account.
                </p>
              </Section>

              {/* Section 16: Contact */}
              <Section id="contact" title="16. Contact Us" icon={Mail}>
                <p>
                  For questions about these Terms of Service, please contact us:
                </p>
                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Legal Department:</strong> legal@farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>General Support:</strong> support@farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Website:</strong> www.farmbond.com</span>
                  </div>
                </div>
              </Section>
            </div>
          </div>

          {/* Back to Home */}
          <motion.div variants={itemVariants} className="text-center pt-8 border-t border-border">
            <Link to="/">
              <Button variant="outline" size="lg">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to FarmBond
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 FarmBond. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/security" className="hover:text-foreground transition-colors">Security</Link>
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
