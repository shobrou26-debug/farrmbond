import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  LayoutDashboard,
  Map,
  Leaf,
  Beef,
  Cloud,
  Bot,
  BarChart3,
  DollarSign,
  Users,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Sprout,
  Calendar,
  MessageSquare,
  Shield,
  TrendingUp,
  HelpCircle,
  Sun,
  Moon,
  Globe,
  Zap,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile, useHaptic, useScrollDirection, useBreakpoint } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { NotificationCenter } from "@/components/NotificationCenter";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// ============================================================
// Navigation Configuration
// ============================================================

interface NavItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string;
  roles?: string[];
}

const farmerNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My Farms", icon: Map, href: "/farms" },
  { label: "Crops", icon: Leaf, href: "/crops" },
  { label: "Livestock", icon: Beef, href: "/livestock" },
  { label: "Weather", icon: Cloud, href: "/weather" },
  { label: "AI Assistant", icon: Bot, href: "/ai-assistant" },
  { label: "Calendar", icon: Calendar, href: "/calendar" },
  { label: "Finances", icon: DollarSign, href: "/finances" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
  { label: "Community", icon: MessageSquare, href: "/community" },
];

const agronomistNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My Profile", icon: Users, href: "/profile" },
  { label: "Consultations", icon: Calendar, href: "/consultations" },
  { label: "Messages", icon: MessageSquare, href: "/messages" },
  { label: "Knowledge Base", icon: Zap, href: "/knowledge" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
];

const adminNavItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Subscriptions", icon: TrendingUp, href: "/admin/subscriptions" },
  { label: "Support", icon: HelpCircle, href: "/admin/support" },
  { label: "Content", icon: Leaf, href: "/admin/content" },
  { label: "Audit Logs", icon: Shield, href: "/admin/audit" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

// ============================================================
// Logo Component
// ============================================================

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-3 group">
      <div className="relative flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-lg group-hover:shadow-xl transition-shadow">
        <Sprout className="w-6 h-6 text-white" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-xl font-bold tracking-tight text-gradient-primary">
            FarmBond
          </span>
          <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
            Smart Farming
          </span>
        </div>
      )}
    </Link>
  );
}

// ============================================================
// Sidebar Component
// ============================================================

function Sidebar({ className }: { className?: string }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const haptic = useHaptic();

  const role = user?.role || "farmer";
  const navItems =
    role === "admin" || role === "super_admin"
      ? adminNavItems
      : role === "agronomist"
      ? agronomistNavItems
      : farmerNavItems;

  const handleSignOut = async () => {
    haptic.medium();
    await signOut();
    navigate("/");
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border",
        className
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
        <Logo collapsed={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-sidebar-accent transition-colors"
        >
          <ChevronDown
            className={cn(
              "w-4 h-4 transition-transform",
              collapsed ? "-rotate-90" : "rotate-0"
            )}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto mobile-scroll">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all tap-highlight-none touch-feedback",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
              onClick={() => haptic.selection()}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.badge && (
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-sidebar-accent text-sidebar-accent-foreground text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-9 h-9">
            <AvatarImage src={user?.image} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-sm">
              {user?.name?.charAt(0) || "U"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
              <p className="text-xs text-sidebar-foreground/60 capitalize">{role}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-sidebar-foreground/60 hover:text-sidebar-foreground touch-target"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Header Component
// ============================================================

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { isHidden, isAtTop } = useScrollDirection();
  const isMobile = useIsMobile();
  const haptic = useHaptic();

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
      className="sticky top-0 z-30 flex items-center h-14 md:h-16 px-3 md:px-6 bg-background/80 backdrop-blur-xl border-b border-border"
      animate={{
        y: isMobile && isHidden ? -64 : 0,
      }}
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
        className="lg:hidden mr-2 touch-target"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Logo on mobile */}
      <div className="flex lg:hidden mr-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-lg gradient-primary">
            <Sprout className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gradient-primary hidden sm:inline">FarmBond</span>
        </Link>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            placeholder={isMobile ? "Search..." : "Search farms, crops, weather..."}
            className="w-full h-10 pl-10 pr-4 text-sm bg-muted/50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20 focus:bg-muted transition-all placeholder:text-muted-foreground/60 touch-manipulation"
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-2 ml-2 md:ml-4">
        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="hidden sm:flex touch-target"
          aria-label="Toggle theme"
        >
          {theme === "light" ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
        </Button>

        {/* Language */}
        <LanguageSwitcher />

        {/* Notifications */}
        <NotificationCenter />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full touch-target">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.image} />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {user?.name?.charAt(0) || "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{user?.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => haptic.selection()}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => haptic.selection()}>
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.header>
  );
}

// ============================================================
// Mobile Bottom Navigation (Enhanced)
// ============================================================

function MobileBottomNav() {
  const location = useLocation();
  const { user } = useAuth();
  const role = user?.role || "farmer";
  const haptic = useHaptic();
  const { isHidden, isAtTop } = useScrollDirection();
  const navRef = useRef<HTMLElement>(null);

  // Primary nav items (top 5 for bottom nav)
  const primaryNavItems =
    role === "admin" || role === "super_admin"
      ? adminNavItems.slice(0, 4)
      : role === "agronomist"
      ? agronomistNavItems.slice(0, 4)
      : farmerNavItems.slice(0, 4);

  // More menu items (remaining items)
  const moreNavItems =
    role === "admin" || role === "super_admin"
      ? adminNavItems.slice(4)
      : role === "agronomist"
      ? agronomistNavItems.slice(4)
      : farmerNavItems.slice(4);

  return (
    <motion.nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden"
      animate={{
        y: isHidden && !isAtTop ? 80 : 0,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop blur bar */}
      <div className="bg-background/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-center h-16 px-1 safe-area-inset-bottom">
          {primaryNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full py-1 transition-all tap-highlight-none",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
                onClick={() => haptic.selection()}
              >
                <motion.div
                  className={cn(
                    "flex items-center justify-center w-10 h-8 rounded-xl transition-all",
                    isActive && "bg-primary/10"
                  )}
                  whileTap={{ scale: 0.9 }}
                >
                  <Icon className={cn("w-5 h-5", isActive && "text-primary")} />
                </motion.div>
                <span className={cn(
                  "text-[10px] font-medium mt-0.5",
                  isActive && "text-primary font-semibold"
                )}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          {/* More button */}
          {moreNavItems.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex flex-col items-center justify-center flex-1 h-full py-1 tap-highlight-none text-muted-foreground active:text-foreground"
                  onClick={() => haptic.selection()}
                >
                  <motion.div
                    className="flex items-center justify-center w-10 h-8 rounded-xl"
                    whileTap={{ scale: 0.9 }}
                  >
                    <MoreHorizontal className="w-5 h-5" />
                  </motion.div>
                  <span className="text-[10px] font-medium mt-0.5">More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 mb-2">
                <DropdownMenuLabel>More Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {moreNavItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link
                        to={item.href}
                        className="flex items-center gap-2 touch-target"
                        onClick={() => haptic.selection()}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Sun className="w-4 h-4 mr-2" />
                  Toggle Theme
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </motion.nav>
  );
}

// ============================================================
// Main Layout Component
// ============================================================

export function AppLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const startX = useRef(0);

  // Swipe gesture to open/close sidebar
  useEffect(() => {
    if (!isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const dx = endX - startX.current;

      // Swipe right from left edge to open
      if (startX.current < 30 && dx > 80) {
        setMobileMenuOpen(true);
      }
      // Swipe left to close
      else if (dx < -80 && mobileMenuOpen) {
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
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 flex-shrink-0">
        <Sidebar />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        <main className="flex-1 overflow-y-auto pb-20 lg:pb-0 mobile-scroll">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav />
    </div>
  );
}

export default AppLayout;
