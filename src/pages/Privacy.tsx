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
  Lock,
  Eye,
  Database,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Cookie,
  Users,
  FileText,
  ExternalLink,
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
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use-information", label: "How We Use Your Information" },
  { id: "cookies-and-tracking", label: "Cookies & Tracking Technologies" },
  { id: "data-sharing", label: "Data Sharing & Third Parties" },
  { id: "data-security", label: "Data Security" },
  { id: "data-retention", label: "Data Retention" },
  { id: "your-rights", label: "Your Rights" },
  { id: "childrens-privacy", label: "Children's Privacy" },
  { id: "international-transfers", label: "International Data Transfers" },
  { id: "changes-to-policy", label: "Changes to This Policy" },
  { id: "contact-us", label: "Contact Us" },
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
      <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none text-muted-foreground leading-relaxed space-y-4">
        {children}
      </div>
    </motion.section>
  );
}

// ============================================================
// Main Privacy Policy Page
// ============================================================

export default function Privacy() {
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
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              Legal
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Privacy Policy
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Your privacy is fundamental to our mission. This policy explains how FarmBond
              collects, uses, and protects your personal information.
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
            {/* Table of Contents (Sidebar) */}
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
                  FarmBond ("we," "our," or "us") is committed to protecting your privacy.
                  This Privacy Policy describes how we collect, use, disclose, and safeguard
                  your information when you use our agricultural platform, including our
                  website, mobile applications, and related services (collectively, the
                  "Service"). By using the Service, you agree to the collection and use of
                  information in accordance with this policy.
                </p>
              </motion.div>

              {/* Section 1: Information We Collect */}
              <Section id="information-we-collect" title="Information We Collect" icon={Database}>
                <h3 className="text-base font-semibold text-foreground">1.1 Information You Provide</h3>
                <p>We collect information you voluntarily provide when you:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Account Registration:</strong> Name, email address, phone number, password, and role (Farmer, Agronomist, Administrator)</li>
                  <li><strong>Farm Profile:</strong> Farm location (GPS coordinates), farm size, crop types, livestock details, and agricultural practices</li>
                  <li><strong>Financial Data:</strong> Income records, expense tracking, and subscription payment information (processed securely via third-party payment processors)</li>
                  <li><strong>Content You Create:</strong> Community posts, AI assistant conversations, uploaded images for disease detection, and knowledge base contributions</li>
                  <li><strong>Communications:</strong> Messages sent through our platform, support tickets, and consultation bookings</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">1.2 Information Collected Automatically</h3>
                <p>When you use the Service, we automatically collect:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Device Information:</strong> Device type, operating system, browser type, and unique device identifiers</li>
                  <li><strong>Usage Data:</strong> Pages viewed, features used, time spent, click patterns, and navigation paths</li>
                  <li><strong>Location Data:</strong> Approximate location based on IP address; precise location only with your explicit consent for farm mapping</li>
                  <li><strong>Log Data:</strong> IP address, access times, referring URLs, and error logs</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">1.3 Information from Third Parties</h3>
                <p>We may receive information from:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Weather Services:</strong> Open-Meteo API provides weather data for your farm locations</li>
                  <li><strong>Satellite Imagery:</strong> ESA Copernicus Sentinel-2 provides NDVI and vegetation analysis data</li>
                  <li><strong>Authentication Providers:</strong> If you sign in via third-party services, we receive basic profile information</li>
                  <li><strong>Market Data:</strong> Publicly available agricultural commodity prices from NAFARM and similar sources</li>
                </ul>
              </Section>

              {/* Section 2: How We Use Information */}
              <Section id="how-we-use-information" title="How We Use Your Information" icon={Eye}>
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Provide the Service:</strong> Deliver farming tools, AI recommendations, weather alerts, and market insights tailored to your operations</li>
                  <li><strong>Personalize Experience:</strong> Customize your dashboard, suggest relevant crops, and adapt content to your farming context</li>
                  <li><strong>Improve Our Platform:</strong> Analyze usage patterns to enhance features, fix bugs, and develop new capabilities</li>
                  <li><strong>AI Training:</strong> Anonymized and aggregated data may be used to improve our AI models for better crop recommendations and disease detection</li>
                  <li><strong>Communications:</strong> Send service updates, weather alerts, market price notifications, and platform announcements</li>
                  <li><strong>Security:</strong> Detect fraud, prevent abuse, and protect the integrity of our platform</li>
                  <li><strong>Legal Compliance:</strong> Meet regulatory obligations and respond to legal requests</li>
                </ul>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>AI & Machine Learning:</strong> Your farm data may be used in anonymized
                      and aggregated form to train our AI models. This helps improve crop yield
                      predictions, disease detection accuracy, and weather-based recommendations
                      for all farmers on the platform. Individual farm data is never shared
                      with other users.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Section 3: Cookies & Tracking */}
              <Section id="cookies-and-tracking" title="Cookies & Tracking Technologies" icon={Cookie}>
                <p>We use cookies and similar technologies to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Essential Cookies:</strong> Required for authentication, security, and core platform functionality. These cannot be disabled.</li>
                  <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the platform, enabling us to optimize performance and user experience.</li>
                  <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements and measure campaign effectiveness for farming products and services.</li>
                  <li><strong>Personalization Cookies:</strong> Remember your preferences, language settings, and dashboard customizations.</li>
                </ul>
                <p>You can manage your cookie preferences at any time through our Cookie Settings, accessible from the footer of any page or your account settings.</p>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 mt-4">
                  <p className="text-sm">
                    <strong>Third-Party Analytics:</strong> We use privacy-focused analytics tools
                    that do not track individual users across websites. All analytics data is
                    aggregated and anonymized.
                  </p>
                </div>
              </Section>

              {/* Section 4: Data Sharing */}
              <Section id="data-sharing" title="Data Sharing & Third Parties" icon={Users}>
                <p>We may share your information with:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Service Providers:</strong> Trusted third-party companies that help us operate our platform (hosting, payment processing, email delivery), bound by strict data protection agreements</li>
                  <li><strong>Weather & Satellite Services:</strong> Open-Meteo and ESA Copernicus receive only your farm coordinates (with consent) to provide localized weather and satellite data</li>
                  <li><strong>Payment Processors:</strong> Stripe, PayPal, MTN Mobile Money, and Airtel Money process payments securely. We do not store your full payment card details.</li>
                  <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets (with continued protection of your data)</li>
                </ul>
                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 mt-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>We never sell your personal data.</strong> Your farm information,
                      financial records, and personal details are never sold to third parties
                      for marketing purposes.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Section 5: Data Security */}
              <Section id="data-security" title="Data Security" icon={Lock}>
                <p>We implement industry-standard security measures to protect your data:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Encryption:</strong> All data is encrypted in transit (TLS 1.3) and at rest (AES-256)</li>
                  <li><strong>Authentication:</strong> Secure password hashing, optional two-factor authentication, and session management</li>
                  <li><strong>Access Controls:</strong> Role-based access control ensures only authorized personnel can access system infrastructure</li>
                  <li><strong>Regular Audits:</strong> Security assessments and penetration testing conducted regularly</li>
                  <li><strong>Incident Response:</strong> Documented procedures for handling security incidents and data breaches</li>
                  <li><strong>Backup & Recovery:</strong> Regular encrypted backups with tested recovery procedures</li>
                </ul>
                <p>While we strive to protect your information, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security but are committed to protecting your data using the best available measures.</p>
              </Section>

              {/* Section 6: Data Retention */}
              <Section id="data-retention" title="Data Retention" icon={Calendar}>
                <p>We retain your information for as long as necessary to:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Active Accounts:</strong> Data is retained for the lifetime of your account plus 30 days after deletion</li>
                  <li><strong>Transaction Records:</strong> Financial records are retained for 7 years as required by tax and accounting regulations</li>
                  <li><strong>Usage Analytics:</strong> Aggregated usage data is retained indefinitely for platform improvement</li>
                  <li><strong>Support Tickets:</strong> Retained for 2 years after resolution for quality assurance</li>
                  <li><strong>AI Training Data:</strong> Anonymized and aggregated data used for model training is retained indefinitely</li>
                </ul>
                <p>You may request deletion of your personal data at any time (see "Your Rights" below).</p>
              </Section>

              {/* Section 7: Your Rights */}
              <Section id="your-rights" title="Your Rights" icon={UserCheck}>
                <p>Depending on your location, you may have the following rights:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {[
                    { title: "Access", desc: "Request a copy of all personal data we hold about you" },
                    { title: "Rectification", desc: "Correct inaccurate or incomplete personal data" },
                    { title: "Deletion", desc: "Request deletion of your personal data (subject to legal obligations)" },
                    { title: "Portability", desc: "Receive your data in a structured, machine-readable format" },
                    { title: "Restriction", desc: "Request restriction of processing in certain circumstances" },
                    { title: "Objection", desc: "Object to processing based on legitimate interests" },
                    { title: "Withdraw Consent", desc: "Withdraw consent for processing at any time" },
                    { title: "Lodge Complaint", desc: "File a complaint with your local data protection authority" },
                  ].map((right, i) => (
                    <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <h4 className="text-sm font-semibold mb-1">{right.title}</h4>
                      <p className="text-xs text-muted-foreground">{right.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4">To exercise any of these rights, please contact us using the information below. We will respond to your request within 30 days.</p>
              </Section>

              {/* Section 8: Children's Privacy */}
              <Section id="childrens-privacy" title="Children's Privacy" icon={Users}>
                <p>
                  FarmBond is not intended for children under the age of 16. We do not knowingly
                  collect personal information from children under 16. If we become aware that
                  we have collected personal information from a child under 16, we will take
                  steps to delete such information promptly.
                </p>
                <p>
                  If you are a parent or guardian and believe your child has provided us with
                  personal information, please contact us immediately.
                </p>
              </Section>

              {/* Section 9: International Transfers */}
              <Section id="international-transfers" title="International Data Transfers" icon={Globe}>
                <p>
                  Your information may be transferred to and processed in countries other than
                  your country of residence. These countries may have different data protection
                  laws than your jurisdiction.
                </p>
                <p>We ensure that international transfers are protected by:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Standard Contractual Clauses (SCCs) approved by relevant authorities</li>
                  <li>Adequacy decisions where applicable</li>
                  <li>Binding Corporate Rules where applicable</li>
                  <li>Your explicit consent where required</li>
                </ul>
              </Section>

              {/* Section 10: Changes to Policy */}
              <Section id="changes-to-policy" title="Changes to This Policy" icon={FileText}>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of
                  any material changes by:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Posting the updated policy on this page with a new "Effective" date</li>
                  <li>Sending an email notification to registered users</li>
                  <li>Displaying a prominent notice in the application</li>
                </ul>
                <p>
                  Your continued use of the Service after any changes constitutes acceptance
                  of the updated policy. We encourage you to review this policy periodically.
                </p>
              </Section>

              {/* Section 11: Contact Us */}
              <Section id="contact-us" title="Contact Us" icon={Mail}>
                <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Email:</strong> privacy@farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Website:</strong> www.farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Data Protection Officer:</strong> dpo@farmbond.com</span>
                  </div>
                </div>
                <p className="mt-4">
                  For users in the European Union, you also have the right to lodge a complaint
                  with your local supervisory authority.
                </p>
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
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
