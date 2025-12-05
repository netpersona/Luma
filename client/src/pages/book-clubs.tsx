import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow, isToday, isTomorrow, isThisWeek } from "date-fns";
import { 
  Users, 
  Plus, 
  Calendar, 
  MessageSquare, 
  Lock, 
  Globe,
  BookOpen,
  ArrowRight,
  Bell,
  Clock,
  MapPin,
  Video,
  ChevronRight,
  X
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BookClubWithDetails, BookClubMeetingWithRsvps } from "@shared/schema";

type UpcomingMeeting = BookClubMeetingWithRsvps & { clubName: string; clubId: string };

function getMeetingTimeLabel(date: Date): string {
  if (isToday(date)) {
    return `Today at ${format(date, "h:mm a")}`;
  } else if (isTomorrow(date)) {
    return `Tomorrow at ${format(date, "h:mm a")}`;
  } else if (isThisWeek(date)) {
    return format(date, "EEEE 'at' h:mm a");
  }
  return format(date, "MMM d 'at' h:mm a");
}

function UpcomingMeetingsNotification({ meetings }: { meetings: UpcomingMeeting[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  
  // Filter out meetings without valid dates and dismissed meetings
  const visibleMeetings = meetings.filter(m => 
    m.meetingDate && !dismissed.has(m.id)
  );
  
  if (visibleMeetings.length === 0) return null;
  
  const urgentMeetings = visibleMeetings.filter(m => {
    const meetingDate = new Date(m.meetingDate!);
    return isToday(meetingDate) || isTomorrow(meetingDate);
  });
  
  const otherMeetings = visibleMeetings.filter(m => {
    const meetingDate = new Date(m.meetingDate!);
    return !isToday(meetingDate) && !isTomorrow(meetingDate);
  });

  return (
    <div className="space-y-3 mb-8">
      {urgentMeetings.map((meeting) => (
        <Alert key={meeting.id} className="border-primary/50 bg-primary/5" data-testid={`alert-meeting-${meeting.id}`}>
          <Bell className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <AlertTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-2">
                {meeting.title}
                {isToday(new Date(meeting.meetingDate!)) && (
                  <Badge variant="default" className="text-xs">Today</Badge>
                )}
                {isTomorrow(new Date(meeting.meetingDate!)) && (
                  <Badge variant="secondary" className="text-xs">Tomorrow</Badge>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setDismissed(prev => new Set([...prev, meeting.id]))}
                data-testid={`button-dismiss-${meeting.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </AlertTitle>
            <AlertDescription className="mt-1">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-4 text-sm flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getMeetingTimeLabel(new Date(meeting.meetingDate!))}
                  </span>
                  {meeting.isVirtual ? (
                    <span className="flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      Virtual
                    </span>
                  ) : meeting.locationName ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {meeting.locationName}
                    </span>
                  ) : null}
                </div>
                <Link href={`/book-clubs/${meeting.clubId}`}>
                  <span className="text-sm text-primary hover:underline flex items-center gap-1">
                    {meeting.clubName}
                    <ChevronRight className="h-3 w-3" />
                  </span>
                </Link>
              </div>
            </AlertDescription>
          </div>
        </Alert>
      ))}
      
      {otherMeetings.length > 0 && (
        <Card className="border-muted" data-testid="card-upcoming-meetings">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Meetings This Week
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {otherMeetings.slice(0, 3).map((meeting) => (
                <Link 
                  key={meeting.id} 
                  href={`/book-clubs/${meeting.clubId}`}
                  className="flex items-center justify-between p-2 rounded-md hover-elevate"
                  data-testid={`link-meeting-${meeting.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      {meeting.isVirtual ? (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">{meeting.clubName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">
                      {getMeetingTimeLabel(new Date(meeting.meetingDate!))}
                    </p>
                    {meeting.userRsvp?.status && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {meeting.userRsvp.status === 'going' ? 'Going' : 
                         meeting.userRsvp.status === 'maybe' ? 'Maybe' : 'Not Going'}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
              {otherMeetings.length > 3 && (
                <p className="text-xs text-muted-foreground text-center pt-2">
                  +{otherMeetings.length - 3} more meetings
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function BookClubsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const { toast } = useToast();

  const { data: clubs, isLoading } = useQuery<BookClubWithDetails[]>({
    queryKey: ["/api/book-clubs"],
  });

  const { data: upcomingMeetings } = useQuery<UpcomingMeeting[]>({
    queryKey: ["/api/meetings/upcoming"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; isPrivate: boolean }) => {
      return apiRequest("POST", "/api/book-clubs", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs"] });
      toast({ title: "Book club created successfully!" });
      setIsCreateOpen(false);
      setName("");
      setDescription("");
      setIsPrivate(false);
    },
    onError: () => {
      toast({ title: "Failed to create book club", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    if (!name.trim()) {
      toast({ title: "Please enter a club name", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name, description, isPrivate });
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Book Clubs
          </h1>
          <p className="text-muted-foreground mt-1">
            Create or join reading communities
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-club">
              <Plus className="h-4 w-4 mr-2" />
              Create Club
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a Book Club</DialogTitle>
              <DialogDescription>
                Start a new reading community and invite others to join.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="club-name">Club Name</Label>
                <Input
                  id="club-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Classic Literature Lovers"
                  data-testid="input-club-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="club-description">Description</Label>
                <Textarea
                  id="club-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What is your book club about?"
                  className="min-h-[100px]"
                  data-testid="input-club-description"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="club-private">Private Club</Label>
                  <p className="text-sm text-muted-foreground">
                    Only invited members can join
                  </p>
                </div>
                <Switch
                  id="club-private"
                  checked={isPrivate}
                  onCheckedChange={setIsPrivate}
                  data-testid="switch-club-private"
                />
              </div>
              <Button 
                onClick={handleCreate} 
                className="w-full"
                disabled={createMutation.isPending}
                data-testid="button-submit-create"
              >
                {createMutation.isPending ? "Creating..." : "Create Club"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Meeting Notifications */}
      {upcomingMeetings && upcomingMeetings.length > 0 && (
        <UpcomingMeetingsNotification meetings={upcomingMeetings} />
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : clubs && clubs.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clubs.map((club) => (
            <Link key={club.id} href={`/book-clubs/${club.id}`}>
              <Card 
                className="overflow-hidden hover-elevate cursor-pointer h-full transition-all flex flex-col"
                data-testid={`card-book-club-${club.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="line-clamp-1">{club.name}</CardTitle>
                    {club.isPrivate ? (
                      <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  {club.description && (
                    <CardDescription className="line-clamp-2">
                      {club.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0 flex-1">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{club.memberCount || 0}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      <span>{club.discussionCount || 0}</span>
                    </div>
                    {club.currentBookId && (
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        <span>Reading</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0 mt-auto">
                  <Button variant="ghost" size="sm" className="ml-auto">
                    View Club
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Book Clubs Yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first book club to start reading together with friends and family.
            </p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-first-club">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Club
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
