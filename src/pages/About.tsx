import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sprout,
  ArrowLeft,
  ArrowRight,
  Heart,
  Target,
  Shield,
  Users,
  Globe,
  Leaf,
  Zap,
  BookOpen,
  Award,
  TrendingUp,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

// ============================================================
// Team Members
// ============================================================

const teamMembers = [
  {
    name: "Dr. Sarah Kimani",
    role: "CEO & Co-Founder",
    bio: "Former agricultural scientist at KALRO with 15 years of experience in crop science. Passionate about leveraging technology to empower smallholder farmers across Africa.",
    avatar: "SK",
    color: "bg-green-500",
  },
  {
    name: "James Ochieng",
    role: "CTO & Co-Founder",
    bio: "Ex-Google engineer with expertise in AI/ML and distributed systems. Built real-time data pipelines serving millions of users before founding FarmBond.",
    avatar: "JO",
    color: "bg-blue-500",
  },
  {
    name: "Maria Wanjiku",
    role: "Head of Product",
    bio: "Product leader with experience at Stripe and Shopify. Specializes in building intuitive tools that make complex technology accessible to everyone.",
    avatar: "MW",
    color: "bg-purple-500",
  },
  {
    name: "Dr. Peter Odhiambo",
    role: "Chief Agronomist",
    bio: "PhD in Plant Pathology from University of Nairobi. Leads our AI-powered crop health recommendations and disease detection systems.",
    avatar: "PO",
    color: "bg-amber-500",
  },
  {
    name: "Grace Nyambura",
    role: "Head of Engineering",
    bio: "Full-stack engineer with a passion for scalable systems. Previously led engineering teams at Safaricom's innovation lab.",
    avatar: "GN",
    color: "bg-rose-500",
  },
  {
    name: "David Mwangi",
    role: "Head of Design",
    bio: "Award-winning designer focused on creating beautiful, accessible experiences. Believes great design should feel invisible and intuitive.",
    avatar: "DM",
    color: "bg-emerald-500",
  },
];

// ============================================================
// Values
// ============================================================

const values = [
  {
    icon: Heart,
    title: "Farmer-First",
    description: "Every decision we make starts with the question: 'How does this help farmers?' Our users aren't just customers—they're partners in our mission to transform agriculture.",
    color: "bg-rose-500",
  },
  {
    icon: Shield,
    title: "Trust & Transparency",
    description: "We earn trust through transparency. Our data practices, pricing, and AI limitations are always clear. We believe informed users make better decisions.",
    color: "bg-blue-500",
  },
  {
    icon: Leaf,
    title: "Sustainability",
    description: "We're building for the long term—both for our business and for the planet. Sustainable farming practices are at the core of every recommendation we make.",
    color: "bg-green-500",
  },
  {
    icon: Zap,
    title: "Innovation with Purpose",
    description: "We adopt new technologies not for novelty, but because they solve real problems. AI, satellite imagery, and real-time data all serve one goal: better farming outcomes.",
    color: "bg-amber-500",
  },
  {
    icon: Users,
    title: "Inclusive by Design",
    description: "Agriculture feeds everyone, so our platform must work for everyone. We design for connectivity challenges, multiple languages, and diverse farming practices.",
    color: "bg-purple-500",
  },
  {
    icon: BookOpen,
    title: "Knowledge Sharing",
    description: "We believe knowledge should flow freely. From our AI assistant to our community forums, we empower farmers to learn from each other and from science.",
    color: "bg-emerald-500",
  },
];

// ============================================================
// Stats
// ============================================================

// Data honesty: capability descriptors, not fabricated adoption/impact
// metrics. Real usage numbers will be shown here once they exist and
// can be verified.
const stats = [
  { value: "24/7", label: "AI Farming Assistant", icon: Zap },
  { value: "Live", label: "Weather & Alerts", icon: Globe },
  { value: "Field-level", label: "Satellite Monitoring", icon: TrendingUp },
  { value: "On-demand", label: "Agronomist Access", icon: Users },
];

// ============================================================
// Main About Page
// ============================================================

export default function About() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-md group-hover:shadow-lg transition-shadow">
              <Sprout className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gradient-primary">
              FarmBond
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-16 py-12 md:py-20"
        >
          {/* Hero Section */}
          <motion.div variants={itemVariants} className="text-center max-w-3xl mx-auto">
            <Badge variant="secondary" className="mb-6">
              <Sprout className="w-3.5 h-3.5 mr-1.5" />
              About FarmBond
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Empowering Farmers with{" "}
              <span className="text-gradient-primary">AI-Powered Intelligence</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
              We're on a mission to help millions of farmers increase productivity, reduce
              losses, and build sustainable farming operations through technology that's
              accessible, affordable, and effective.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="p-6 rounded-2xl bg-card border border-border/50 text-center">
                  <Icon className="w-6 h-6 text-primary mx-auto mb-3" />
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              );
            })}
          </motion.div>

          {/* Mission Section */}
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="secondary" className="mb-4">
                  <Target className="w-3.5 h-3.5 mr-1.5" />
                  Our Mission
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                  Making Precision Agriculture Accessible to Every Farmer
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Agriculture is the backbone of economies across Africa and the developing
                    world, yet millions of smallholder farmers lack access to the tools and
                    information that large-scale operations take for granted.
                  </p>
                  <p>
                    FarmBond was founded in 2024 with a simple but powerful idea: what if
                    every farmer had access to AI-powered insights, real-time weather data,
                    satellite monitoring, and expert agronomic advice—all from their phone?
                  </p>
                  <p>
                    FarmBond is built to give every farmer—from smallholder plots to
                    commercial operations—the same precision-agriculture tools that large
                    agribusinesses rely on. We are committed to measuring our impact
                    transparently as our community grows.
                  </p>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-8 flex items-center justify-center">
                  <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
                    {[
                      { icon: Leaf, label: "Crop Health", value: "AI Scans", color: "bg-green-500" },
                      { icon: Globe, label: "Weather", value: "Live", color: "bg-blue-500" },
                      { icon: Zap, label: "AI Assistant", value: "24/7", color: "bg-purple-500" },
                      { icon: TrendingUp, label: "Yield Insights", value: "Data-driven", color: "bg-amber-500" },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} className="p-4 rounded-xl bg-card border border-border/50 shadow-sm">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${item.color} mb-2`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-lg font-bold">{item.value}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Values Section */}
          <motion.div variants={itemVariants}>
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">
                <Heart className="w-3.5 h-3.5 mr-1.5" />
                Our Values
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                What We Stand For
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Our values guide every decision we make, from product design to customer support.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, i) => {
                const Icon = value.icon;
                return (
                  <motion.div
                    key={i}
                    variants={itemVariants}
                    className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all"
                  >
                    <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${value.color} mb-4`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Team Section */}
          <motion.div variants={itemVariants}>
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">
                <Users className="w-3.5 h-3.5 mr-1.5" />
                Our Team
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Meet the People Behind FarmBond
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                A diverse team of agricultural scientists, engineers, designers, and
                operators united by a shared mission.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamMembers.map((member, i) => (
                <motion.div
                  key={i}
                  variants={itemVariants}
                  className="p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`flex items-center justify-center w-14 h-14 rounded-xl ${member.color} text-white text-lg font-bold`}>
                      {member.avatar}
                    </div>
                    <div>
                      <h3 className="font-semibold">{member.name}</h3>
                      <p className="text-sm text-primary">{member.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{member.bio}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Story Section */}
          <motion.div variants={itemVariants}>
            <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-border/50">
              <div className="max-w-3xl mx-auto text-center">
                <Award className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
                  Our Story
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed text-left">
                  <p>
                    FarmBond was born from a simple observation: while large agribusinesses had
                    access to precision agriculture tools, satellite imagery, and AI-powered
                    analytics, smallholder farmers—who produce over 70% of Africa's food—were
                    still making decisions based on guesswork and outdated information.
                  </p>
                  <p>
                    FarmBond was built by a team of agricultural scientists, software
                    engineers, and designers who saw firsthand how a lack of timely information
                    can devastate a harvest—and who believe technology can give every farmer a
                    fair chance.
                  </p>
                  <p>
                    Since 2024, we've been building and testing the platform alongside
                    agronomists and farmers, refining the science, the data, and the experience
                    before we scale.
                  </p>
                  <p>
                    FarmBond is now open to farmers everywhere. We are committed to transparent,
                    verifiable impact: as our community grows, we will publish real, measured
                    results—not estimates.
                  </p>
                  <p>
                    But we're just getting started. Our goal is to make precision agriculture
                    accessible to every farmer who wants it—regardless of their scale, location,
                    or technical expertise.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* CTA Section */}
          <motion.div variants={itemVariants} className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Join Us in Transforming Agriculture
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Whether you're a farmer looking to optimize your operations, an agronomist
              wanting to reach more clients, or a technologist passionate about impact—we'd
              love to have you on board.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="gradient-primary px-8">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/marketplace">
                <Button size="lg" variant="outline" className="px-8">
                  <Users className="w-5 h-5 mr-2" />
                  Join as Agronomist
                </Button>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2026 FarmBond. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
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
