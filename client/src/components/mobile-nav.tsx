import { Link, useLocation } from "wouter";
import { Library, BookOpen, FolderOpen, Search, Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Library",
    url: "/",
    icon: Library,
    testId: "mobile-nav-library",
  },
  {
    title: "Reading",
    url: "/reading",
    icon: BookOpen,
    testId: "mobile-nav-reading",
  },
  {
    title: "Collections",
    url: "/collections",
    icon: FolderOpen,
    testId: "mobile-nav-collections",
  },
  {
    title: "Discover",
    url: "/discover",
    icon: Search,
    testId: "mobile-nav-discover",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "mobile-nav-settings",
  },
];

export function MobileNav() {
  const isMobile = useIsMobile();
  const [location] = useLocation();

  // Hide mobile nav on reader pages and when not on mobile
  const isReaderPage = location.startsWith("/reader/");
  
  if (!isMobile || isReaderPage) {
    return null;
  }

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t safe-area-inset-bottom"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location === item.url || 
            (item.url === "/" && location === "/") ||
            (item.url !== "/" && location.startsWith(item.url));
          
          return (
            <Link key={item.url} href={item.url}>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[64px]",
                  isActive 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover-elevate"
                )}
                data-testid={item.testId}
                aria-current={isActive ? "page" : undefined}
              >
                <item.icon className={cn(
                  "h-5 w-5",
                  isActive && "text-primary"
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  isActive && "text-primary"
                )}>
                  {item.title}
                </span>
              </button>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
