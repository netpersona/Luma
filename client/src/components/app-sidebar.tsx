import { BookOpen, Headphones, Library, FolderOpen, Plus, Clock, Tag, Search, Settings, Globe, BarChart3, BookMarked, Target, Users, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ObjectUploader } from "@/components/object-uploader";
import { useAuth } from "@/contexts/AuthContext";

const libraryItems = [
  {
    title: "All Media",
    url: "/",
    icon: Library,
    testId: "link-all-media",
  },
  {
    title: "Books",
    url: "/books",
    icon: BookOpen,
    testId: "link-books",
  },
  {
    title: "Audiobooks",
    url: "/audiobooks",
    icon: Headphones,
    testId: "link-audiobooks",
  },
  {
    title: "Collections",
    url: "/collections",
    icon: FolderOpen,
    testId: "link-collections",
  },
];

const smartItems = [
  {
    title: "Currently Reading",
    url: "/reading",
    icon: Clock,
    testId: "link-reading",
  },
  {
    title: "Recently Added",
    url: "/recent",
    icon: Plus,
    testId: "link-recent",
  },
  {
    title: "Reading Goals",
    url: "/goals",
    icon: Target,
    testId: "link-goals",
  },
  {
    title: "Statistics",
    url: "/statistics",
    icon: BarChart3,
    testId: "link-statistics",
  },
  {
    title: "Series",
    url: "/series",
    icon: BookMarked,
    testId: "link-series",
  },
  {
    title: "Book Clubs",
    url: "/book-clubs",
    icon: Users,
    testId: "link-book-clubs",
  },
];

const integrationItems = [
  {
    title: "Discover Books",
    url: "/discover",
    icon: Search,
    testId: "link-discover",
  },
  {
    title: "OPDS Catalogs",
    url: "/opds",
    icon: Globe,
    testId: "link-opds",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "link-settings",
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const uploadIdsRef = useState<string[]>([])[0];

  const handleGetUploadParameters = async () => {
    const res = await fetch("/api/objects/upload", { method: "POST" });
    const { uploadURL, uploadId } = await res.json();
    uploadIdsRef.push(uploadId);
    console.log('[Sidebar Upload] Got upload ID:', uploadId);
    return { method: "PUT" as const, url: uploadURL };
  };

  const handleUploadComplete = async (result: any) => {
    try {
      console.log('[Sidebar Upload] Complete with', result.successful?.length, 'successful files');
      
      if (!result.successful || result.successful.length === 0) {
        uploadIdsRef.length = 0;
        return;
      }
      
      if (uploadIdsRef.length === 0) {
        console.error('[Sidebar Upload] No upload IDs stored!');
        alert('Upload failed: No upload IDs found. Please try again.');
        return;
      }

      const response = await fetch("/api/process-uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadIds: [...uploadIdsRef] }),
      });

      if (!response.ok) {
        throw new Error("Failed to process uploads");
      }

      uploadIdsRef.length = 0;
      window.location.reload();
    } catch (error) {
      console.error("Error processing uploads:", error);
      uploadIdsRef.length = 0;
      alert('Upload failed. Check console for details.');
    }
  };

  return (
    <Sidebar aria-label="Main navigation">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" aria-hidden="true" />
          <span className="text-xl font-bold">Luma</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel id="library-nav-label">Library</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-labelledby="library-nav-label">
              {libraryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                    aria-current={location === item.url ? "page" : undefined}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" aria-hidden="true" />

        <SidebarGroup>
          <SidebarGroupLabel id="smart-nav-label">Smart Collections</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-labelledby="smart-nav-label">
              {smartItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                    aria-current={location === item.url ? "page" : undefined}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="my-2" aria-hidden="true" />

        <SidebarGroup>
          <SidebarGroupLabel id="integrations-nav-label">Integrations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu aria-labelledby="integrations-nav-label">
              {integrationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={item.testId}
                    aria-current={location === item.url ? "page" : undefined}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" aria-hidden="true" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === "admin" && (
          <>
            <Separator className="my-2" aria-hidden="true" />

            <SidebarGroup>
              <SidebarGroupLabel id="admin-nav-label">Administration</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu aria-labelledby="admin-nav-label">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      isActive={location === "/admin"}
                      data-testid="link-admin"
                      aria-current={location === "/admin" ? "page" : undefined}
                    >
                      <Link href="/admin">
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        <span>Admin Panel</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <ObjectUploader
          maxNumberOfFiles={20}
          allowedFileTypes={['.epub', '.pdf', '.mobi', '.cbz', '.cbr', '.m4b', '.mp3', '.m4a']}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="w-full"
          buttonVariant="default"
        >
          <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
          Upload Files
        </ObjectUploader>
      </SidebarFooter>
    </Sidebar>
  );
}
