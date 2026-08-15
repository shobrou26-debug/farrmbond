import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "convex/react";
import {
  LayoutDashboard,
  Map,
  Leaf,
  Beef,
  Cloud,
  CloudLightning,
  Bot,
  Microscope,
  TrendingUp,
  BarChart3,
  Calendar,
  Droplets,
  DollarSign,
  GitCompareArrows,
  FileText,
  Users,
  MessageSquare,
  BookOpen,
  HelpCircle,
  Store,
  CalendarClock,
  Sprout,
  Building2,
  CalendarDays,
  User,
  Settings,
  CreditCard,
  Shield,
  Menu,
  ChevronDown,
  LogOut,
  Sun,
  Moon,
  MoreHorizontal,
  MapPin,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile, useHaptic, useScrollDirection } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { api } from "@/convex/_generated/api";
import { NotificationCenter } from "@/components/NotificationCenter";
import { CookieConsentBanner, CookiePreferencesModal } from "@/components/CookiePreferences";
import { AdPopup } from "@/components/AdPopup";

// ============================================================
// Navigation Configuration — grouped, premium hierarchy
// ============================================================

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const overviewGroup: NavGroup = {
  label: "Overview",
  items: [{ label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
};

const farmGroup: NavGroup = {
  label: "Farm",
  items: [
    { label: "My Farms", icon: Map, href: "/farms" },
    { label: "Crops", icon: Leaf, href: "/crops" },
    { label: "Livestock", icon: Beef, href: "/livestock" },
  ],
};

const intelligenceGroup: NavGroup = {
  label: "Intelligence",
  items: [
    { label: "Weather", icon: Cloud, href: "/weather" },
    { label: "Weather Alerts", icon: CloudLightning, href: "/weather-alerts" },
    { label: "Farm AI", icon: Bot, href: "/ai-assistant" },
    { label: "Disease Detection", icon: Microscope, href: "/disease-detection" },
    { label: "Yield Prediction", icon: TrendingUp, href: "/yield-prediction" },
    { label: "Analytics", icon: BarChart3, href: "/analytics" },
  ],
};

const managementGroup: NavGroup = {
  label: "Management",
  items: [
    { label: "Calendar", icon: Calendar, href: "/calendar" },
    { label: "Irrigation", icon: Droplets, href: "/irrigation" },
    { label: "Finances", icon: DollarSign, href: "/finances" },
    { label: "Farm Comparison", icon: GitCompareArrows, href: "/farm-comparison" },
    { label: "Weekly Report", icon: FileText, href: "/weekly-report" },
  ],
};

const communityGroup: NavGroup = {
  label: "Community",
  items: [
    { label: "Community", icon: Users, href: "/community" },
    { label: "Messages", icon: MessageSquare, href: "/messages" },
    { label: "Knowledge", icon: BookOpen, href: "/knowledge" },
    { label: "Support", icon: HelpCircle, href: "/support" },
  ],
};

const marketplaceGroup: NavGroup = {
  label: "Marketplace",
  items: [
    { label: "Marketplace", icon: Store, href: "/marketplace" },
    { label: "Consultations", icon: CalendarClock, href: "/my-consultations" },
    { label: "Seeds", icon: Sprout, href: "/seeds" },
    { label: "Companies", icon: Building2, href: "/companies" },
    { label: "Events", icon: CalendarDays, href: "/events" },
  ],
};

const accountGroup: NavGroup = {
  label: "Account",
  items: [
    { label: "Profile", icon: User, href: "/profile" },
    { label: "Settings", icon: Settings, href: "/settings" },
    { label: "Payment History", icon: CreditCard, href: "/payment-history" },
  ],
};

const farmerGroups: NavGroup[] = [
  overviewGroup,
  farmGroup,
  intelligenceGroup,
  managementGroup,
  communityGroup,
  marketplaceGroup,
  accountGroup,
];

const agronomistGroups: NavGroup[] = [
  overviewGroup,
  {
    label: "Professional",
    items: [
      { label: "My Profile", icon: User, href: "/profile" },
      { label: "Consultations", icon: CalendarClock, href: "/my-consultations" },
      { label: "Messages", icon: MessageSquare, href: "/messages" },
      { label: "Knowledge", icon: BookOpen, href: "/knowledge" },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", icon: BarChart3, href: "/analytics" },
      { label: "Weather", icon: Cloud, href: "/weather" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", icon: Settings, href: "/settings" },
      { label: "Payment History", icon: CreditCard, href: "/payment-history" },
    ],
  },
];

const adminGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
      { label: "Users", icon: Users, href: "/admin/users" },
      { label: "Subscriptions", icon: CreditCard, href: "/admin/subscriptions" },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Support", icon: HelpCircle, href: "/admin/support" },
      { label: "Content", icon: LayoutGrid, href: "/admin/content" },
      { label: "Audit Logs", icon: Shield, href: "/audit-log" },
      { label: "Seed Management", icon: Sprout, href: "/admin/seeds" },
      { label: "Settings", icon: Settings, href: "/admin/settings" },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Profile", icon: User, href: "/profile" },
      { label: "Payment History", icon: CreditCard, href: "/payment-history" },
    ],
  },
];

function getNavGroups(role?: string): NavGroup[] {
  if (role === "admin" || role === "super_admin") return adminGroups;
  if (role === "agronomist") return agronomistGroups;
  return farmerGroups;
}

// ============================================================
// Page title / breadcrumb lookup
// ============================================================

const PAGE_TITLES: Array<[string, string]> = [
  ["/farms/new", "New Farm"],
  ["/dashboard", "Dashboard"],
  ["/farms", "My Farms"],
  ["/crops", "Crops"],
  ["/livestock", "Livestock"],
  ["/weather-alerts", "Weather Alerts"],
  ["/weather", "Weather"],
  ["/ai-assistant", "Farm AI"],
  ["/disease-detection", "Disease Detection"],
  ["/yield-prediction", "Yield Prediction"],
  ["/analytics", "Analytics"],
  ["/calendar", "Calendar"],
  ["/irrigation", "Irrigation"],
  ["/finances", "Finances"],
  ["/farm-comparison", "Farm Comparison"],
  ["/weekly-report", "Weekly Report"],
  ["/community", "Community"],
  ["/messages", "Messages"],
  ["/knowledge", "Knowledge"],
  ["/support", "Support"],
  ["/marketplace", "Marketplace"],
  ["/my-consultations", "My Consultations"],
  ["/consultations", "My Consultations"],
  ["/seeds", "Seeds"],
  ["/companies", "Companies"],
  ["/events", "Events"],
  ["/profile", "Profile"],
  ["/settings", "Settings"],
  ["/payment-history", "Payment History"],
  ["/audit-log", "Audit Logs"],
  ["/admin/audit", "Audit Logs"],
  ["/admin/users", "User Management"],
  ["/admin/subscriptions", "Subscriptions"],
  ["/admin/support", "Support Tickets"],
  ["/admin/content", "Content Moderation"],
  ["/admin/seeds", "Seed Management"],
  ["/admin/settings", "Admin Settings"],
  ["/admin", "Admin Dashboard"],
];

function getPageTitle(pathname: string): string {
  const exact = PAGE_TITLES.find(([route]) => pathname === route);
  if (exact) return exact[1];
  // Prefix fallback (e.g. unknown admin subroutes)
  const prefix = PAGE_TITLES.find(([route]) => pathname.startsWith(`${route}/`));
  return prefix ? prefix[1] : pathname === "/" ? "Home" : "FarmBond";
}

function getActiveGroup(pathname: string, groups: NavGroup[]): string | null {
  for (const group of groups) {
    if (group.items.some((item) => pathname === item.href)) return group.label;
  }
  return null;
}

// ============================================================
// Logo
// ============================================================

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="group flex items-center gap-3" aria-label="FarmBond home">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand shadow-sm transition-transform group-hover:scale-105">
        <Sprout className="h-6 w-6 text-brand-foreground" />
      </div>
      {!collapsed && (
        <div className="flex min-w-0 flex-col">
          <span className="text-lg font-bold leading-tight tracking-tight text-foreground">
            FarmBond
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Smart Farming
          </span>
        </div>
      )}
    </Link>
  );
}

// ============================================================
// Farm Context (real data only — never fabricated)
// ============================================================

function FarmContext({ collapsed = false }: { collapsed?: boolean }) {
  const farms = useQuery(api.farms.listUserFarms, {});
  const firstFarm = farms?.page?.[0];

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            to="/farms"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
            aria-label={firstFarm ? `Working farm: ${firstFarm.name}` : "Select a farm"}
          >
            <MapPin className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">
          {firstFarm ? `Working farm: ${firstFarm.name}` : "Select a farm"}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!firstFarm) {
    return (
      <Link
        to="/farms/new"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-3 transition-colors hover:border-brand/50 hover:bg-brand/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
          <MapPin className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Select a farm</p>
          <p className="truncate text-xs text-muted-foreground">
            Choose the farm you're working with
          </p>
        </div>
      </Link>
    );
  }

  const location = [firstFarm.location?.city, firstFarm.location?.country]
    .filter(Boolean)
    .join(", ");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/farms"
          className="group flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3 transition-colors hover:border-brand/50 hover:bg-brand/5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand-foreground transition-transform group-hover:scale-105 dark:text-brand">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{firstFarm.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {location || "Registered farm"}
            </p>
          </div>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right">View all farms</TooltipContent>
    </Tooltip>
  );
}

// ============================================================
// Single Navigation Row
// ============================================================

function NavRow({
  item,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const haptic = useHaptic();
  const isActive = location.pathname === item.href;
  const Icon = item.icon;

  const link = (
    <Link
      to={item.href}
      onClick={() => {
        haptic.selection();
        onNavigate?.();
      }}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all tap-highlight-none",
        isActive
          ? "bg-brand/10 text-brand-foreground dark:text-brand"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-brand" />
      )}
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-brand-foreground dark:text-brand" : "text-muted-foreground/80",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

// ============================================================
// Grouped Navigation (shared by sidebar + mobile "More" sheet)
// ============================================================

function SidebarNav({
  groups,
  collapsed = false,
  onNavigate,
}: {
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {groups.map((group) => (
        <div key={group.label}>
          {!collapsed && (
            <p className="px-3 pb-1.5 pt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {group.label}
            </p>
          )}
          {collapsed && <div className="mx-auto my-3 h-px w-8 bg-border" />}
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavRow key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Sidebar
// ============================================================

function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const role = user?.role;
  const groups = getNavGroups(role);

  const handleSignOut = async () => {
    haptic.medium();
    await signOut();
    navigate("/");
  };

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-background">
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-5",
          collapsed && "justify-center px-2",
        )}
      >
        <Logo collapsed={collapsed} />
        {onToggleCollapsed && (
          <button
            onClick={() => {
              haptic.light();
              onToggleCollapsed();
            }}
            className="hidden lg:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            <ChevronDown
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "-rotate-90")}
            />
          </button>
        )}
      </div>

      {/* Farm context */}
      <div className={cn("px-4", collapsed && "flex justify-center px-2")}>
        <FarmContext collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 mobile-scroll" aria-label="Primary navigation">
        <SidebarNav groups={groups} collapsed={collapsed} onNavigate={onNavigate} />
      </nav>

      {/* User profile */}
      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent",
                collapsed && "justify-center px-0",
              )}
              aria-label="Account menu"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand-foreground dark:text-brand">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {user?.name || "User"}
                    </p>
                    <p className="truncate text-xs capitalize text-muted-foreground">
                      {role?.replace("_", " ") || "Farmer"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? "start" : "end"} side="top" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <p className="truncate text-sm font-medium">{user?.name || "User"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" onClick={() => haptic.selection()}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" onClick={() => haptic.selection()}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============================================================
// Header
// ============================================================

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { isHidden } = useScrollDirection();
  const isMobile = useIsMobile();
  const haptic = useHaptic();
  const role = user?.role;
  const title = getPageTitle(location.pathname);
  const groupLabel = getActiveGroup(location.pathname, getNavGroups(role));

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const toggleTheme = () => {
    haptic.light();
    document.documentElement.classList.toggle("dark");
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <motion.header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-xl md:h-16 md:px-6"
      animate={{ y: isMobile && isHidden ? -64 : 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          haptic.light();
          onMenuClick();
        }}
        className="lg:hidden mr-1 touch-target"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile logo */}
      <Link to="/" className="flex lg:hidden items-center gap-2 mr-2" aria-label="FarmBond home">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
          <Sprout className="h-4 w-4 text-brand-foreground" />
        </div>
      </Link>

      {/* Page title / breadcrumb */}
      <div className="min-w-0 flex-1">
        <p className="hidden truncate text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground lg:block">
          FarmBond{groupLabel ? ` / ${groupLabel}` : ""}
        </p>
        <h1 className="truncate text-sm font-semibold text-foreground lg:text-base">{title}</h1>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden sm:flex touch-target"
          aria-label="Toggle theme"
        >
          {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </Button>

        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full touch-target" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-brand/15 text-sm font-semibold text-brand-foreground dark:text-brand">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <p className="truncate text-sm font-medium">{user?.name || "User"}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" onClick={() => haptic.selection()}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings" onClick={() => haptic.selection()}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/support" onClick={() => haptic.selection()}>
                <HelpCircle className="mr-2 h-4 w-4" />
                Help &amp; Support
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}

// ============================================================
// Mobile Bottom Navigation + "More" Sheet
// ============================================================

function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role;
  const haptic = useHaptic();
  const { isHidden, isAtTop } = useScrollDirection();
  const [moreOpen, setMoreOpen] = useState(false);
  const groups = getNavGroups(role);

  const primaryItems: NavItem[] =
    role === "admin" || role === "super_admin"
      ? [
          { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
          { label: "Users", icon: Users, href: "/admin/users" },
          { label: "Support", icon: HelpCircle, href: "/admin/support" },
          { label: "Audit", icon: Shield, href: "/audit-log" },
        ]
      : role === "agronomist"
      ? [
          { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
          { label: "Consultations", icon: CalendarClock, href: "/my-consultations" },
          { label: "Messages", icon: MessageSquare, href: "/messages" },
          { label: "Profile", icon: User, href: "/profile" },
        ]
      : [
          { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
          { label: "Farms", icon: Map, href: "/farms" },
          { label: "AI", icon: Bot, href: "/ai-assistant" },
          { label: "Weather", icon: Cloud, href: "/weather" },
        ];

  return (
    <>
      <motion.nav
        className="fixed bottom-0 left-0 right-0 z-40 lg:hidden"
        animate={{ y: isHidden && !isAtTop ? 88 : 0 }}
        transition={{ duration: 0.2 }}
        aria-label="Bottom navigation"
      >
        <div className="border-t border-border bg-background/95 backdrop-blur-xl">
          <div className="flex h-16 items-center px-1 pb-[env(safe-area-inset-bottom)]">
            {primaryItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex h-full flex-1 flex-col items-center justify-center gap-0.5 py-1.5 tap-highlight-none",
                    isActive ? "text-brand-foreground dark:text-brand" : "text-muted-foreground",
                  )}
                  onClick={() => haptic.selection()}
                >
                  <motion.div
                    className={cn(
                      "flex h-8 w-12 items-center justify-center rounded-xl transition-colors",
                      isActive && "bg-brand/10 dark:bg-brand/15",
                    )}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Icon className="h-5 w-5" />
                  </motion.div>
                  <span className="text-[10px] font-medium">{item.label}</span>
                </Link>
              );
            })}

            {/* More */}
            <button
              className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-muted-foreground tap-highlight-none active:text-foreground"
              onClick={() => {
                haptic.light();
                setMoreOpen(true);
              }}
              aria-label="Open all navigation"
            >
              <motion.div className="flex h-8 w-12 items-center justify-center rounded-xl" whileTap={{ scale: 0.9 }}>
                <MoreHorizontal className="h-5 w-5" />
              </motion.div>
              <span className="text-[10px] font-medium">More</span>
            </button>
          </div>
        </div>
      </motion.nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="h-[82dvh] gap-0 rounded-t-3xl p-0"
        >
          <SheetTitle className="sr-only">All navigation</SheetTitle>
          <div className="flex items-center border-b border-border px-5 py-4 pr-14">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand">
                <Sprout className="h-4 w-4 text-brand-foreground" />
              </div>
              <span className="text-base font-bold">FarmBond</span>
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-4 pb-10 pt-2">
              <SidebarNav groups={groups} onNavigate={() => setMoreOpen(false)} />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ============================================================
// Main Layout Component
// ============================================================

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const startX = useRef(0);
  const shouldReduceMotion = useReducedMotion();

  // Swipe gesture to open/close sidebar
  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX.current;

      if (startX.current < 30 && dx > 80) {
        setMobileMenuOpen(true);
      } else if (dx < -80 && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isMobile, mobileMenuOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 transition-[width] duration-300 ease-out",
          sidebarCollapsed ? "lg:w-[76px]" : "lg:w-[264px] xl:w-[288px]",
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[300px] gap-0 border-r-0 p-0 sm:w-[320px]">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar collapsed={false} onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 mobile-scroll">
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />

      {/* Cookie Consent */}
      <CookieConsentBanner />
      <CookiePreferencesModal />

      {/* Ad Popups */}
      <AdPopup />
    </div>
  );
}

export default AppLayout;
