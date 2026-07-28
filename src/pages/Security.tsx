import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sprout,
  Shield,
  ArrowLeft,
  ChevronRight,
  Lock,
  Key,
  Eye,
  Server,
  Database,
  AlertTriangle,
  CheckCircle2,
  Bug,
  Mail,
  Globe,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Fingerprint,
  Network,
  RefreshCw,
  Users,
  Search,
  Zap,
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
  { id: "overview", label: "Security Overview" },
  { id: "encryption", label: "Encryption" },
  { id: "authentication", label: "Authentication & Access" },
  { id: "infrastructure", label: "Infrastructure Security" },
  { id: "data-protection", label: "Data Protection" },
  { id: "monitoring", label: "Monitoring & Logging" },
  { id: "incident-response", label: "Incident Response" },
  { id: "compliance", label: "Compliance" },
  { id: "bug-bounty", label: "Bug Bounty Program" },
  { id: "contact", label: "Contact Security Team" },
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
// Stat Card
// ============================================================

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color} mx-auto mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

// ============================================================
// Main Security Page
// ============================================================

export default function SecurityPage() {
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
              <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
              Trust & Safety
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Security at FarmBond
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Protecting your farm data is our top priority. We employ enterprise-grade
              security measures to keep your information safe and private.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={Lock} label="Encryption Standard" value="AES-256" color="bg-green-500" />
            <StatCard icon={Shield} label="Uptime SLA" value="99.9%" color="bg-blue-500" />
            <StatCard icon={Eye} label="Security Audits" value="Quarterly" color="bg-purple-500" />
            <StatCard icon={Bug} label="Bug Bounty" value="Active" color="bg-amber-500" />
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
              {/* Overview */}
              <Section id="overview" title="Security Overview" icon={ShieldCheck}>
                <p>
                  FarmBond is built with security-first principles. Our platform handles sensitive
                  agricultural data including farm locations, financial records, and personal
                  information. We understand the trust you place in us and maintain rigorous
                  security standards to protect it.
                </p>
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <p className="text-sm">
                    <strong>Our Commitment:</strong> We undergo regular third-party security audits,
                    maintain SOC 2 Type II compliance, and follow OWASP guidelines for web
                    application security. Security is not a feature — it's foundational to everything
                    we build.
                  </p>
                </div>
              </Section>

              {/* Encryption */}
              <Section id="encryption" title="Encryption" icon={Lock}>
                <h3 className="text-base font-semibold text-foreground">Data in Transit</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>TLS 1.3:</strong> All data transmitted between your device and our servers is encrypted using the latest TLS protocol</li>
                  <li><strong>HSTS:</strong> HTTP Strict Transport Security enforced to prevent downgrade attacks</li>
                  <li><strong>Certificate Pinning:</strong> Mobile apps use certificate pinning to prevent man-in-the-middle attacks</li>
                  <li><strong>Perfect Forward Secrecy:</strong> Session keys are ephemeral, ensuring past communications remain secure even if keys are compromised</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Data at Rest</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>AES-256 Encryption:</strong> All stored data is encrypted using AES-256, the industry gold standard</li>
                  <li><strong>Envelope Encryption:</strong> Data encryption keys are themselves encrypted with master keys stored in hardware security modules (HSMs)</li>
                  <li><strong>Key Rotation:</strong> Encryption keys are automatically rotated every 90 days</li>
                  <li><strong>Database Encryption:</strong> Convex database instances use encryption at rest by default</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">End-to-End Encryption</h3>
                <p>
                  Private messages between farmers and agronomists, as well as sensitive financial
                  data, are protected with end-to-end encryption. This means only you and the
                  intended recipient can read the content — not even FarmBond can access it.
                </p>
              </Section>

              {/* Authentication & Access */}
              <Section id="authentication" title="Authentication & Access Control" icon={Key}>
                <h3 className="text-base font-semibold text-foreground">Authentication</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Secure Password Hashing:</strong> Passwords are hashed using bcrypt with a cost factor of 12</li>
                  <li><strong>Email OTP:</strong> Passwordless authentication via one-time codes sent to your email</li>
                  <li><strong>Session Management:</strong> Secure, HTTP-only cookies with automatic expiration</li>
                  <li><strong>Multi-Factor Authentication:</strong> Optional 2FA for enhanced account security</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Authorization</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Role-Based Access Control (RBAC):</strong> Four distinct roles: Farmer, Agronomist, Administrator, and Super Administrator</li>
                  <li><strong>Principle of Least Privilege:</strong> Users and services only have access to what they need</li>
                  <li><strong>Row-Level Security:</strong> Database queries are filtered by user ID, ensuring you can only access your own farm data</li>
                  <li><strong>API Rate Limiting:</strong> Prevents abuse and ensures fair usage across all users</li>
                </ul>

                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/20 mt-4">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                    <p className="text-sm">
                      <strong>Your Data, Your Control:</strong> Each farmer's data is completely
                      isolated. No farmer can access another farmer's crops, finances, or farm
                      details without explicit sharing permissions.
                    </p>
                  </div>
                </div>
              </Section>

              {/* Infrastructure Security */}
              <Section id="infrastructure" title="Infrastructure Security" icon={Server}>
                <h3 className="text-base font-semibold text-foreground">Hosting & Network</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Cloud-Native Architecture:</strong> Deployed on enterprise-grade cloud infrastructure with built-in DDoS protection</li>
                  <li><strong>Web Application Firewall:</strong> WAF rules protect against common attack vectors including SQL injection, XSS, and CSRF</li>
                  <li><strong>Network Segmentation:</strong> Production, staging, and development environments are isolated</li>
                  <li><strong>VPN Access:</strong> Administrative access requires VPN connection with MFA verification</li>
                </ul>

                <h3 className="text-base font-semibold text-foreground mt-6">Vulnerability Management</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Automated Scanning:</strong> Continuous dependency scanning for known vulnerabilities</li>
                  <li><strong>Dependency Updates:</strong> Automated pull requests for security patches within 48 hours of disclosure</li>
                  <li><strong>Penetration Testing:</strong> Quarterly third-party penetration tests by certified ethical hackers</li>
                  <li><strong>Code Review:</strong> All code changes require security review before deployment</li>
                </ul>
              </Section>

              {/* Data Protection */}
              <Section id="data-protection" title="Data Protection" icon={Database}>
                <h3 className="text-base font-semibold text-foreground">Data Classification</h3>
                <p>We classify data into four sensitivity levels and apply appropriate protections:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {[
                    { level: "Critical", desc: "Payment info, authentication credentials", color: "bg-red-500/10 text-red-600 border-red-500/20" },
                    { level: "Confidential", desc: "Farm data, financial records, personal info", color: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
                    { level: "Internal", desc: "Usage analytics, system logs", color: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
                    { level: "Public", desc: "Marketing content, public profiles", color: "bg-green-500/10 text-green-600 border-green-500/20" },
                  ].map((item, i) => (
                    <div key={i} className={`p-3 rounded-xl border ${item.color}`}>
                      <p className="text-sm font-semibold">{item.level}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>

                <h3 className="text-base font-semibold text-foreground mt-6">Data Backup & Recovery</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Automated Backups:</strong> Continuous incremental backups with point-in-time recovery</li>
                  <li><strong>Geo-Redundancy:</strong> Backups stored in multiple geographic regions</li>
                  <li><strong>Recovery Testing:</strong> Monthly disaster recovery drills to ensure restore procedures work</li>
                  <li><strong>Retention Policy:</strong> Backups retained for 90 days with encrypted storage</li>
                </ul>
              </Section>

              {/* Monitoring & Logging */}
              <Section id="monitoring" title="Monitoring & Logging" icon={Eye}>
                <p>
                  We maintain comprehensive monitoring to detect and respond to security events:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Real-Time Monitoring:</strong> 24/7 automated monitoring of all systems for anomalies</li>
                  <li><strong>Audit Logging:</strong> All user actions are logged with timestamps, IP addresses, and user agents</li>
                  <li><strong>Intrusion Detection:</strong> AI-powered anomaly detection identifies suspicious patterns</li>
                  <li><strong>Alert System:</strong> Automated alerts for unusual login attempts, data access patterns, and system changes</li>
                  <li><strong>Log Retention:</strong> Security logs retained for 1 year for forensic analysis</li>
                </ul>
                <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 mt-4">
                  <p className="text-sm">
                    <strong>Transparency:</strong> Enterprise customers can access their audit logs
                    through the Admin Dashboard, providing full visibility into who accessed
                    their data and when.
                  </p>
                </div>
              </Section>

              {/* Incident Response */}
              <Section id="incident-response" title="Incident Response" icon={AlertTriangle}>
                <p>
                  We maintain a comprehensive incident response plan to handle security events
                  quickly and effectively:
                </p>
                <div className="space-y-3 mt-4">
                  {[
                    { step: "1", title: "Detection & Analysis", desc: "Automated systems and human analysts identify and classify security events" },
                    { step: "2", title: "Containment", desc: "Immediate actions to limit the scope and impact of the incident" },
                    { step: "3", title: "Eradication", desc: "Root cause analysis and removal of the threat" },
                    { step: "4", title: "Recovery", desc: "Restoring affected systems and verifying integrity" },
                    { step: "5", title: "Notification", desc: "Communicating with affected users within 72 hours as required by law" },
                    { step: "6", title: "Post-Incident Review", desc: "Lessons learned and improvements to prevent recurrence" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
                        <span className="text-xs font-bold text-primary">{item.step}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Compliance */}
              <Section id="compliance" title="Compliance & Certifications" icon={FileText}>
                <p>
                  FarmBond adheres to industry standards and regulatory requirements:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {[
                    { title: "SOC 2 Type II", desc: "Independent audit of security, availability, and confidentiality controls", icon: ShieldCheck },
                    { title: "GDPR Compliant", desc: "Full compliance with EU data protection regulations", icon: Globe },
                    { title: "CCPA Compliant", desc: "California Consumer Privacy Act compliance for US users", icon: Users },
                    { title: "ISO 27001", desc: "Information security management system certification (in progress)", icon: Shield },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <p className="text-sm font-semibold">{item.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* Bug Bounty */}
              <Section id="bug-bounty" title="Bug Bounty Program" icon={Bug}>
                <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10">
                      <Bug className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold">Responsible Disclosure Program</h3>
                      <p className="text-xs text-muted-foreground">Help us keep FarmBond secure</p>
                    </div>
                  </div>
                  <p className="text-sm mb-4">
                    We value the security research community and invite you to help us identify
                    vulnerabilities. If you discover a security issue, please report it responsibly
                    through our bug bounty program.
                  </p>
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Reward Tiers</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { severity: "Critical", reward: "$500 - $2,000", desc: "Remote code execution, authentication bypass, data exfiltration", color: "bg-red-500/10 text-red-600" },
                        { severity: "High", reward: "$200 - $500", desc: "Privilege escalation, significant data exposure, CSRF on sensitive actions", color: "bg-orange-500/10 text-orange-600" },
                        { severity: "Medium", reward: "$50 - $200", desc: "XSS, information disclosure, denial of service", color: "bg-amber-500/10 text-amber-600" },
                      ].map((tier, i) => (
                        <div key={i} className={`p-3 rounded-xl ${tier.color}`}>
                          <p className="text-sm font-semibold">{tier.severity}</p>
                          <p className="text-lg font-bold mt-1">{tier.reward}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{tier.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-background/50 border border-border/50">
                    <h4 className="text-sm font-semibold mb-2">Rules of Engagement</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Do not access or modify data belonging to other users</li>
                      <li>• Do not perform denial of service attacks</li>
                      <li>• Do not exploit vulnerabilities for purposes beyond testing</li>
                      <li>• Report findings privately to security@farmbond.com</li>
                      <li>• Allow reasonable time for remediation before public disclosure</li>
                    </ul>
                  </div>
                </div>
              </Section>

              {/* Contact */}
              <Section id="contact" title="Contact Security Team" icon={Mail}>
                <p>
                  For security-related inquiries, vulnerability reports, or to request
                  additional security information:
                </p>
                <div className="p-6 rounded-2xl bg-muted/30 border border-border/50 mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Security Team:</strong> security@farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Bug className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Bug Reports:</strong> bugs@farmbond.com</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>PGP Key:</strong> Available on request</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-sm"><strong>Incident Response:</strong> incidents@farmbond.com</span>
                  </div>
                </div>
                <p className="mt-4">
                  For urgent security matters, please include "URGENT" in your email subject line.
                  Our security team monitors this inbox 24/7.
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
            <Link to="/security" className="hover:text-foreground transition-colors">Security</Link>
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
