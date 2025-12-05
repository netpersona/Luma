import { useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Users, 
  Calendar, 
  MessageSquare, 
  ArrowLeft, 
  Settings,
  Plus,
  Copy,
  Check,
  MapPin,
  Video,
  Clock,
  UserPlus,
  LogOut,
  Send,
  BookOpen,
  Edit,
  Trash2,
  ExternalLink,
  ChevronLeft,
  Reply
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import type { BookClubWithDetails, BookClubDiscussion, BookClubMeetingWithRsvps } from "@shared/schema";

export default function BookClubDetailPage() {
  const [, params] = useRoute("/book-clubs/:id");
  const clubId = params?.id;
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const [isCreateMeetingOpen, setIsCreateMeetingOpen] = useState(false);
  const [isCreateTopicOpen, setIsCreateTopicOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  
  // Topic-based discussions state
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicContent, setTopicContent] = useState("");
  const [topicChapterInfo, setTopicChapterInfo] = useState("");
  const [replyText, setReplyText] = useState("");
  
  // Meeting form state
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [isVirtual, setIsVirtual] = useState(false);
  const [virtualLink, setVirtualLink] = useState("");

  const { data: club, isLoading } = useQuery<BookClubWithDetails>({
    queryKey: ["/api/book-clubs", clubId],
    enabled: !!clubId,
  });

  const { data: meetings } = useQuery<BookClubMeetingWithRsvps[]>({
    queryKey: ["/api/book-clubs", clubId, "meetings"],
    enabled: !!clubId,
  });

  // Fetch topics only (top-level discussions)
  const { data: topics } = useQuery<BookClubDiscussion[]>({
    queryKey: [`/api/book-clubs/${clubId}/discussions?topicsOnly=true`],
    enabled: !!clubId,
  });

  // Fetch selected topic with replies
  const { data: topicWithReplies } = useQuery<{ topic: BookClubDiscussion; replies: BookClubDiscussion[] }>({
    queryKey: [`/api/book-clubs/${clubId}/discussions/${selectedTopicId}`],
    enabled: !!clubId && !!selectedTopicId,
  });

  // Join club mutation
  const joinMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/join`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs", clubId] });
      toast({ title: "You've joined the club!" });
      setIsMember(true);
    },
    onError: () => {
      toast({ title: "Failed to join club", variant: "destructive" });
    },
  });

  // Leave club mutation
  const leaveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs", clubId] });
      toast({ title: "You've left the club" });
      setIsMember(false);
    },
    onError: () => {
      toast({ title: "Failed to leave club", variant: "destructive" });
    },
  });

  // Create meeting mutation
  const createMeetingMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      meetingDate: string;
      locationName: string;
      address: string;
      isVirtual: boolean;
      virtualLink: string;
    }) => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/meetings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs", clubId, "meetings"] });
      toast({ title: "Meeting scheduled!" });
      setIsCreateMeetingOpen(false);
      resetMeetingForm();
    },
    onError: () => {
      toast({ title: "Failed to create meeting", variant: "destructive" });
    },
  });

  // RSVP mutation
  const rsvpMutation = useMutation({
    mutationFn: async ({ meetingId, status }: { meetingId: string; status: string }) => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/meetings/${meetingId}/rsvp`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs", clubId, "meetings"] });
      toast({ title: "RSVP updated!" });
    },
    onError: () => {
      toast({ title: "Failed to update RSVP", variant: "destructive" });
    },
  });

  // Create topic mutation
  const createTopicMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; chapterInfo?: string }) => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/discussions`, {
        ...data,
        userId: user?.id,
        userName: user?.displayName || user?.username || "Anonymous",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/book-clubs/${clubId}/discussions?topicsOnly=true`] });
      setTopicTitle("");
      setTopicContent("");
      setTopicChapterInfo("");
      setIsCreateTopicOpen(false);
      toast({ title: "Topic created!" });
    },
    onError: () => {
      toast({ title: "Failed to create topic", variant: "destructive" });
    },
  });

  // Post reply mutation
  const postReplyMutation = useMutation({
    mutationFn: async (data: { content: string; parentId: string }) => {
      return apiRequest("POST", `/api/book-clubs/${clubId}/discussions`, {
        ...data,
        userId: user?.id,
        userName: user?.displayName || user?.username || "Anonymous",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/book-clubs/${clubId}/discussions/${selectedTopicId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/book-clubs/${clubId}/discussions?topicsOnly=true`] });
      setReplyText("");
      toast({ title: "Reply posted!" });
    },
    onError: () => {
      toast({ title: "Failed to post reply", variant: "destructive" });
    },
  });

  // Delete club mutation
  const deleteClubMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/book-clubs/${clubId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/book-clubs"] });
      toast({ title: "Book club deleted", description: "The book club has been permanently deleted." });
      navigate("/book-clubs");
    },
    onError: () => {
      toast({ title: "Failed to delete club", variant: "destructive" });
    },
  });

  const resetMeetingForm = () => {
    setMeetingTitle("");
    setMeetingDescription("");
    setMeetingDate("");
    setMeetingTime("");
    setLocationName("");
    setAddress("");
    setIsVirtual(false);
    setVirtualLink("");
  };

  const handleCreateMeeting = () => {
    if (!meetingTitle.trim() || !meetingDate || !meetingTime) {
      toast({ title: "Please fill in required fields", variant: "destructive" });
      return;
    }

    const dateTime = new Date(`${meetingDate}T${meetingTime}`);
    
    createMeetingMutation.mutate({
      title: meetingTitle,
      description: meetingDescription,
      meetingDate: dateTime.toISOString(),
      locationName,
      address,
      isVirtual,
      virtualLink,
    });
  };

  const handleCopyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopiedAddress(addr);
      toast({ title: "Address copied!" });
      setTimeout(() => setCopiedAddress(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const openInMaps = (addr: string) => {
    const encoded = encodeURIComponent(addr);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, "_blank");
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="container mx-auto p-6 max-w-5xl text-center">
        <h1 className="text-2xl font-bold mb-4">Club Not Found</h1>
        <Button asChild variant="outline">
          <Link href="/book-clubs">Back to Book Clubs</Link>
        </Button>
      </div>
    );
  }

  const memberCount = club.memberCount || 0;
  // Check if the current user is a member of this club
  const isCurrentMember = user && (
    club.members?.some(m => m.userId === user.id) || isMember
  );
  
  // Check if the current user is a club admin (creator, has admin role in club, or is a system admin)
  const isClubAdmin = user && (
    club.createdBy === user.id || 
    club.members?.some(m => m.userId === user.id && m.role === 'admin') ||
    user.role === 'admin'
  );

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" data-testid="button-back">
          <Link href="/book-clubs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Book Clubs
          </Link>
        </Button>
      </div>

      {/* Club Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-club-name">{club.name}</h1>
            <p className="text-muted-foreground">{club.description || "No description"}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </span>
              {club.currentBook && (
                <span className="flex items-center gap-1">
                  <BookOpen className="h-4 w-4" />
                  Currently reading
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isCurrentMember ? (
            <Button 
              variant="outline" 
              onClick={() => leaveMutation.mutate()}
              disabled={leaveMutation.isPending}
              data-testid="button-leave-club"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Leave Club
            </Button>
          ) : (
            <Button 
              onClick={() => joinMutation.mutate()}
              disabled={joinMutation.isPending}
              data-testid="button-join-club"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Join Club
            </Button>
          )}
          {isClubAdmin && (
            <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="text-destructive hover:text-destructive"
                  data-testid="button-delete-club"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Club
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Book Club</DialogTitle>
                  <DialogDescription>
                    Are you sure you want to delete "{club.name}"? This action cannot be undone. 
                    All meetings, discussions, and member data will be permanently removed.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setIsDeleteConfirmOpen(false)}
                    data-testid="button-cancel-delete"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteClubMutation.mutate()}
                    disabled={deleteClubMutation.isPending}
                    data-testid="button-confirm-delete"
                  >
                    {deleteClubMutation.isPending ? "Deleting..." : "Delete Club"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="meetings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="meetings" data-testid="tab-meetings">
            <Calendar className="h-4 w-4 mr-2" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="discussions" data-testid="tab-discussions">
            <MessageSquare className="h-4 w-4 mr-2" />
            Discussions
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="h-4 w-4 mr-2" />
            Members
          </TabsTrigger>
        </TabsList>

        {/* Meetings Tab */}
        <TabsContent value="meetings" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Upcoming Meetings</h2>
            <Dialog open={isCreateMeetingOpen} onOpenChange={setIsCreateMeetingOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-schedule-meeting">
                  <Plus className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Schedule a Meeting</DialogTitle>
                  <DialogDescription>
                    Plan your next book club gathering.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-title">Meeting Title *</Label>
                    <Input
                      id="meeting-title"
                      value={meetingTitle}
                      onChange={(e) => setMeetingTitle(e.target.value)}
                      placeholder="e.g., Monthly Book Discussion"
                      data-testid="input-meeting-title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="meeting-description">Description</Label>
                    <Textarea
                      id="meeting-description"
                      value={meetingDescription}
                      onChange={(e) => setMeetingDescription(e.target.value)}
                      placeholder="What will you discuss?"
                      className="min-h-[80px]"
                      data-testid="input-meeting-description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meeting-date">Date *</Label>
                      <Input
                        id="meeting-date"
                        type="date"
                        value={meetingDate}
                        onChange={(e) => setMeetingDate(e.target.value)}
                        data-testid="input-meeting-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="meeting-time">Time *</Label>
                      <Input
                        id="meeting-time"
                        type="time"
                        value={meetingTime}
                        onChange={(e) => setMeetingTime(e.target.value)}
                        data-testid="input-meeting-time"
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="is-virtual">Virtual Meeting</Label>
                      <p className="text-sm text-muted-foreground">
                        Meet online instead of in-person
                      </p>
                    </div>
                    <Switch
                      id="is-virtual"
                      checked={isVirtual}
                      onCheckedChange={setIsVirtual}
                      data-testid="switch-is-virtual"
                    />
                  </div>

                  {isVirtual ? (
                    <div className="space-y-2">
                      <Label htmlFor="virtual-link">Meeting Link</Label>
                      <Input
                        id="virtual-link"
                        value={virtualLink}
                        onChange={(e) => setVirtualLink(e.target.value)}
                        placeholder="https://zoom.us/j/..."
                        data-testid="input-virtual-link"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="location-name">Location Name</Label>
                        <Input
                          id="location-name"
                          value={locationName}
                          onChange={(e) => setLocationName(e.target.value)}
                          placeholder="e.g., Central Library, Joe's Coffee"
                          data-testid="input-location-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Textarea
                          id="address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="123 Main St, City, State 12345"
                          className="min-h-[60px]"
                          data-testid="input-address"
                        />
                        <p className="text-xs text-muted-foreground">
                          Members can copy this to open in Google Maps
                        </p>
                      </div>
                    </>
                  )}

                  <Button 
                    onClick={handleCreateMeeting} 
                    className="w-full"
                    disabled={createMeetingMutation.isPending}
                    data-testid="button-submit-meeting"
                  >
                    {createMeetingMutation.isPending ? "Scheduling..." : "Schedule Meeting"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {meetings && meetings.length > 0 ? (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <Card key={meeting.id} data-testid={`card-meeting-${meeting.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-lg">{meeting.title}</CardTitle>
                        {meeting.description && (
                          <CardDescription className="mt-1">
                            {meeting.description}
                          </CardDescription>
                        )}
                      </div>
                      {meeting.isVirtual ? (
                        <Badge variant="secondary">
                          <Video className="h-3 w-3 mr-1" />
                          Virtual
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          <MapPin className="h-3 w-3 mr-1" />
                          In-Person
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {meeting.meetingDate && format(new Date(meeting.meetingDate), "EEEE, MMMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {meeting.meetingDate && format(new Date(meeting.meetingDate), "h:mm a")}
                        </span>
                      </div>
                    </div>

                    {meeting.isVirtual && meeting.virtualLink ? (
                      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                        <Video className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={meeting.virtualLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          Join Meeting
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ) : meeting.address ? (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            {meeting.locationName && (
                              <p className="font-medium">{meeting.locationName}</p>
                            )}
                            <p className="text-sm text-muted-foreground">{meeting.address}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCopyAddress(meeting.address!)}
                            data-testid={`button-copy-address-${meeting.id}`}
                          >
                            {copiedAddress === meeting.address ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3 mr-1" />
                                Copy Address
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openInMaps(meeting.address!)}
                            data-testid={`button-open-maps-${meeting.id}`}
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            Open in Maps
                          </Button>
                        </div>
                      </div>
                    ) : null}

                    {/* RSVP Counts */}
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">RSVPs:</span>
                      <Badge variant="secondary" className="text-green-600">
                        {meeting.rsvpCounts?.going || 0} Going
                      </Badge>
                      <Badge variant="secondary" className="text-yellow-600">
                        {meeting.rsvpCounts?.maybe || 0} Maybe
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter className="gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground mr-2">Your RSVP:</span>
                    <Button
                      variant={meeting.userRsvp?.status === 'going' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => rsvpMutation.mutate({ meetingId: meeting.id, status: 'going' })}
                      disabled={rsvpMutation.isPending}
                      data-testid={`button-rsvp-going-${meeting.id}`}
                    >
                      Going
                    </Button>
                    <Button
                      variant={meeting.userRsvp?.status === 'maybe' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => rsvpMutation.mutate({ meetingId: meeting.id, status: 'maybe' })}
                      disabled={rsvpMutation.isPending}
                      data-testid={`button-rsvp-maybe-${meeting.id}`}
                    >
                      Maybe
                    </Button>
                    <Button
                      variant={meeting.userRsvp?.status === 'not_going' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => rsvpMutation.mutate({ meetingId: meeting.id, status: 'not_going' })}
                      disabled={rsvpMutation.isPending}
                      data-testid={`button-rsvp-not-going-${meeting.id}`}
                    >
                      Can't Go
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Meetings Scheduled</h3>
                <p className="text-muted-foreground mb-4">
                  Schedule your first meeting to get the club together!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Discussions Tab */}
        <TabsContent value="discussions" className="space-y-6">
          {/* Topic View - show topic with replies */}
          {selectedTopicId && topicWithReplies ? (
            <div className="space-y-6">
              {/* Back button */}
              <Button 
                variant="ghost" 
                onClick={() => setSelectedTopicId(null)}
                className="gap-2"
                data-testid="button-back-to-topics"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Topics
              </Button>

              {/* Topic Header Card */}
              <Card data-testid={`card-topic-detail-${topicWithReplies.topic.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">{topicWithReplies.topic.title || "Untitled Topic"}</CardTitle>
                      {topicWithReplies.topic.chapterInfo && (
                        <Badge variant="outline" className="mb-3">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {topicWithReplies.topic.chapterInfo}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {(topicWithReplies.topic.userName || "A").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{topicWithReplies.topic.userName || "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground">
                          {topicWithReplies.topic.createdAt && formatDistanceToNow(new Date(topicWithReplies.topic.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{topicWithReplies.topic.content}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Replies Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Reply className="h-5 w-5" />
                  Replies ({topicWithReplies.replies.length})
                </h3>

                {topicWithReplies.replies.length > 0 ? (
                  topicWithReplies.replies.map((reply) => (
                    <Card key={reply.id} className="ml-6" data-testid={`card-reply-${reply.id}`}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-sm">
                              {(reply.userName || "A").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-sm">{reply.userName || "Anonymous"}</span>
                              <span className="text-xs text-muted-foreground">
                                {reply.createdAt && formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{reply.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm ml-6">No replies yet. Be the first to respond!</p>
                )}

                {/* Reply Input */}
                <Card className="ml-6">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex gap-2">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="min-h-[60px] resize-none"
                        data-testid="input-reply"
                      />
                    </div>
                    <div className="flex justify-end mt-2">
                      <Button
                        onClick={() => postReplyMutation.mutate({ 
                          content: replyText, 
                          parentId: selectedTopicId 
                        })}
                        disabled={!replyText.trim() || postReplyMutation.isPending}
                        size="sm"
                        data-testid="button-post-reply"
                      >
                        <Send className="h-4 w-4 mr-2" />
                        Reply
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            /* Topics List View */
            <div className="space-y-6">
              {/* Create Topic Button */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Discussion Topics</h3>
                <Dialog open={isCreateTopicOpen} onOpenChange={setIsCreateTopicOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-new-topic">
                      <Plus className="h-4 w-4 mr-2" />
                      New Topic
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                      <DialogTitle>Start a New Discussion</DialogTitle>
                      <DialogDescription>
                        Create a topic to discuss with your book club members
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="topic-title">Topic Title *</Label>
                        <Input
                          id="topic-title"
                          value={topicTitle}
                          onChange={(e) => setTopicTitle(e.target.value)}
                          placeholder="What do you want to discuss?"
                          data-testid="input-topic-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="topic-chapter">Chapter/Section (optional)</Label>
                        <Input
                          id="topic-chapter"
                          value={topicChapterInfo}
                          onChange={(e) => setTopicChapterInfo(e.target.value)}
                          placeholder="e.g., Chapter 5, Pages 100-120"
                          data-testid="input-topic-chapter"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="topic-content">Your Thoughts *</Label>
                        <Textarea
                          id="topic-content"
                          value={topicContent}
                          onChange={(e) => setTopicContent(e.target.value)}
                          placeholder="Share your thoughts, questions, or observations..."
                          className="min-h-[120px]"
                          data-testid="input-topic-content"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => setIsCreateTopicOpen(false)}
                        data-testid="button-cancel-topic"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => createTopicMutation.mutate({
                          title: topicTitle,
                          content: topicContent,
                          chapterInfo: topicChapterInfo || undefined,
                        })}
                        disabled={!topicTitle.trim() || !topicContent.trim() || createTopicMutation.isPending}
                        data-testid="button-create-topic"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Topic
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Topics List */}
              {topics && topics.length > 0 ? (
                <div className="space-y-3">
                  {topics.map((topic) => (
                    <Card 
                      key={topic.id} 
                      className="cursor-pointer hover-elevate transition-shadow"
                      onClick={() => setSelectedTopicId(topic.id)}
                      data-testid={`card-topic-${topic.id}`}
                    >
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {(topic.userName || "A").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-medium truncate">{topic.title || "Untitled Topic"}</h4>
                              <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                <MessageSquare className="h-4 w-4" />
                                <span className="text-xs">{topic.replyCount || 0}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-sm text-muted-foreground">{topic.userName || "Anonymous"}</span>
                              <span className="text-xs text-muted-foreground">·</span>
                              <span className="text-xs text-muted-foreground">
                                {topic.createdAt && formatDistanceToNow(new Date(topic.createdAt), { addSuffix: true })}
                              </span>
                              {topic.chapterInfo && (
                                <>
                                  <span className="text-xs text-muted-foreground">·</span>
                                  <Badge variant="outline" className="text-xs py-0">
                                    <BookOpen className="h-3 w-3 mr-1" />
                                    {topic.chapterInfo}
                                  </Badge>
                                </>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                              {topic.content}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="text-center py-12">
                  <CardContent>
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Discussion Topics Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start the conversation by creating the first topic!
                    </p>
                    <Button onClick={() => setIsCreateTopicOpen(true)} data-testid="button-new-topic-empty">
                      <Plus className="h-4 w-4 mr-2" />
                      New Topic
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="space-y-6">
          <h2 className="text-xl font-semibold">Club Members</h2>
          
          {club.members && club.members.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {club.members.map((member) => (
                <Card key={member.id} data-testid={`card-member-${member.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {(member.userId || "M").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.userId}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant={member.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                            {member.role}
                          </Badge>
                          {member.joinedAt && (
                            <span className="text-xs text-muted-foreground">
                              Joined {formatDistanceToNow(new Date(member.joinedAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Members Yet</h3>
                <p className="text-muted-foreground">
                  Be the first to join this club!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
