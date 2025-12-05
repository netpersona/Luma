import { type CSSProperties, type ReactNode, useEffect } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SkipLink } from "@/components/skip-link";
import { MobileNav } from "@/components/mobile-nav";
import { DownloadProgress } from "@/components/DownloadProgress";
import { ThemeProvider as BookloreThemeProvider } from "@/contexts/ThemeContext";
import { UIScaleProvider } from "@/contexts/UIScaleContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { DownloadProvider } from "@/contexts/DownloadContext";
import { Loader2 } from "lucide-react";
import Library from "@/pages/library";
import Books from "@/pages/books";
import Audiobooks from "@/pages/audiobooks";
import BookDetail from "@/pages/book-detail";
import AudiobookDetail from "@/pages/audiobook-detail";
import Collections from "@/pages/collections";
import CollectionDetail from "@/pages/collection-detail";
import CurrentlyReading from "@/pages/currently-reading";
import RecentlyAdded from "@/pages/recently-added";
import EpubReader from "@/pages/epub-reader";
import PdfReader from "@/pages/pdf-reader";
import Discover from "@/pages/discover";
import Settings from "@/pages/settings";
import BaroqueDemo from "@/pages/baroque-demo";
import CottagecoreDemo from "@/pages/cottagecore-demo";
import Baroque2Demo from "@/pages/baroque-2-demo";
import Cottagecore2Demo from "@/pages/cottagecore-2-demo";
import AcanthusDemo from "@/pages/acanthus-demo";
import ArtDecoDemo from "@/pages/art-deco-demo";
import ArtNouveauDemo from "@/pages/art-nouveau-demo";
import GothicDemo from "@/pages/gothic-demo";
import DarkAcademiaDemo from "@/pages/dark-academia-demo";
import Opds from "@/pages/opds";
import Statistics from "@/pages/statistics";
import Series from "@/pages/series";
import Goals from "@/pages/goals";
import CarMode from "@/pages/car-mode";
import BookClubs from "@/pages/book-clubs";
import BookClubDetail from "@/pages/book-club-detail";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Setup from "@/pages/setup";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Luma...</p>
      </div>
    </div>
  );
}

function AuthRouter() {
  const { isAuthenticated, needsSetup, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (needsSetup) {
    if (location !== "/setup") {
      return <Redirect to="/setup" />;
    }
    return <Setup />;
  }

  if (!isAuthenticated) {
    if (location === "/login") return <Login />;
    if (location === "/register") return <Register />;
    return <Redirect to="/login" />;
  }

  if (location === "/login" || location === "/register" || location === "/setup") {
    return <Redirect to="/" />;
  }

  return <ProtectedApp />;
}

function ProtectedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Library} />
      <Route path="/books" component={Books} />
      <Route path="/audiobooks" component={Audiobooks} />
      <Route path="/books/:id" component={BookDetail} />
      <Route path="/audiobooks/:id" component={AudiobookDetail} />
      <Route path="/reader/epub/:id" component={EpubReader} />
      <Route path="/reader/pdf/:id" component={PdfReader} />
      <Route path="/collections/:id" component={CollectionDetail} />
      <Route path="/collections" component={Collections} />
      <Route path="/reading" component={CurrentlyReading} />
      <Route path="/recent" component={RecentlyAdded} />
      <Route path="/discover" component={Discover} />
      <Route path="/opds" component={Opds} />
      <Route path="/statistics" component={Statistics} />
      <Route path="/series" component={Series} />
      <Route path="/goals" component={Goals} />
      <Route path="/car-mode/:id" component={CarMode} />
      <Route path="/book-clubs" component={BookClubs} />
      <Route path="/book-clubs/:id" component={BookClubDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/admin" component={Admin} />
      <Route path="/theme/baroque" component={BaroqueDemo} />
      <Route path="/theme/cottagecore" component={CottagecoreDemo} />
      <Route path="/theme/baroque-2" component={Baroque2Demo} />
      <Route path="/theme/cottagecore-2" component={Cottagecore2Demo} />
      <Route path="/theme/acanthus" component={AcanthusDemo} />
      <Route path="/theme/art-deco" component={ArtDecoDemo} />
      <Route path="/theme/art-nouveau" component={ArtNouveauDemo} />
      <Route path="/theme/gothic" component={GothicDemo} />
      <Route path="/theme/dark-academia" component={DarkAcademiaDemo} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedApp() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <DownloadProvider>
      <SidebarProvider style={style as CSSProperties}>
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header 
              className="flex items-center justify-between gap-4 p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10"
              role="banner"
              aria-label="Main navigation header"
            >
              <SidebarTrigger 
                data-testid="button-sidebar-toggle" 
                aria-label="Toggle sidebar navigation"
              />
              <ThemeToggle />
            </header>
            <main 
              id="main-content" 
              className="flex-1 overflow-y-auto pb-16 md:pb-0"
              role="main"
              aria-label="Main content"
              tabIndex={-1}
            >
              <ProtectedRoutes />
            </main>
          </div>
        </div>
        <MobileNav />
        <DownloadProgress />
      </SidebarProvider>
    </DownloadProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UIScaleProvider>
        <BookloreThemeProvider>
          <ThemeProvider defaultTheme="light">
            <TooltipProvider>
              <AuthProvider>
                <AuthRouter />
              </AuthProvider>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </BookloreThemeProvider>
      </UIScaleProvider>
    </QueryClientProvider>
  );
}
