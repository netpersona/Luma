import { useQuery } from "@tanstack/react-query";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Headphones, Clock, Trophy, TrendingUp, Calendar } from "lucide-react";
import { parseJsonArray } from "@/lib/utils";
import type { BookWithProgress, AudiobookWithProgress } from "@shared/schema";

interface ReadingStats {
  totalBooks: number;
  completedBooks: number;
  inProgressBooks: number;
  totalAudiobooks: number;
  completedAudiobooks: number;
  inProgressAudiobooks: number;
  readingStreak: number;
  totalReadingHours: number;
  totalListeningHours: number;
  booksThisMonth: number;
  booksThisYear: number;
  audiobooksThisMonth: number;
  audiobooksThisYear: number;
  topAuthors: { name: string; count: number }[];
  topGenres: { name: string; count: number }[];
  monthlyProgress: { month: string; books: number; audiobooks: number }[];
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "hsl(var(--accent))", "hsl(var(--muted))"];

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  value: string | number; 
  description?: string; 
  icon: React.ElementType 
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Statistics() {
  // Force refetch when statistics page loads to ensure fresh data
  // This is needed because reading progress updates don't invalidate the cache
  const { data: books = [], isLoading: booksLoading } = useQuery<BookWithProgress[]>({
    queryKey: ["/api/books"],
    staleTime: 0, // Always consider data stale on this page
    refetchOnMount: 'always', // Always refetch when this component mounts
  });

  const { data: audiobooks = [], isLoading: audiobooksLoading } = useQuery<AudiobookWithProgress[]>({
    queryKey: ["/api/audiobooks"],
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const isLoading = booksLoading || audiobooksLoading;

  const stats: ReadingStats = (() => {
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    const completedBooks = books.filter(b => b.progress?.completed);
    const inProgressBooks = books.filter(b => b.progress && !b.progress.completed && b.progress.progress > 0);
    const completedAudiobooks = audiobooks.filter(a => a.progress?.completed);
    const inProgressAudiobooks = audiobooks.filter(a => a.progress && !a.progress.completed && a.progress.progress > 0);

    const booksThisMonth = completedBooks.filter(b => {
      if (!b.progress?.lastReadAt) return false;
      const readDate = new Date(b.progress.lastReadAt);
      return readDate.getMonth() === thisMonth && readDate.getFullYear() === thisYear;
    }).length;

    const booksThisYear = completedBooks.filter(b => {
      if (!b.progress?.lastReadAt) return false;
      const readDate = new Date(b.progress.lastReadAt);
      return readDate.getFullYear() === thisYear;
    }).length;

    const audiobooksThisMonth = completedAudiobooks.filter(a => {
      if (!a.progress?.lastListenedAt) return false;
      const listenedDate = new Date(a.progress.lastListenedAt);
      return listenedDate.getMonth() === thisMonth && listenedDate.getFullYear() === thisYear;
    }).length;

    const audiobooksThisYear = completedAudiobooks.filter(a => {
      if (!a.progress?.lastListenedAt) return false;
      const listenedDate = new Date(a.progress.lastListenedAt);
      return listenedDate.getFullYear() === thisYear;
    }).length;

    const authorCounts = new Map<string, number>();
    books.forEach(book => {
      if (book.author) {
        const count = authorCounts.get(book.author) || 0;
        authorCounts.set(book.author, count + 1);
      }
    });
    audiobooks.forEach(audiobook => {
      if (audiobook.author) {
        const count = authorCounts.get(audiobook.author) || 0;
        authorCounts.set(audiobook.author, count + 1);
      }
    });
    const topAuthors = Array.from(authorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const genreCounts = new Map<string, number>();
    [...books, ...audiobooks].forEach(item => {
      parseJsonArray(item.tags).forEach(tag => {
        const count = genreCounts.get(tag) || 0;
        genreCounts.set(tag, count + 1);
      });
    });
    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const monthlyProgress: { month: string; books: number; audiobooks: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() - i);
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();
      const monthName = targetDate.toLocaleDateString("en-US", { month: "short" });
      
      const monthBooks = completedBooks.filter(b => {
        if (!b.progress?.lastReadAt) return false;
        const readDate = new Date(b.progress.lastReadAt);
        return readDate.getMonth() === targetMonth && readDate.getFullYear() === targetYear;
      }).length;
      const monthAudiobooks = completedAudiobooks.filter(a => {
        if (!a.progress?.lastListenedAt) return false;
        const listenedDate = new Date(a.progress.lastListenedAt);
        return listenedDate.getMonth() === targetMonth && listenedDate.getFullYear() === targetYear;
      }).length;
      monthlyProgress.push({ month: monthName, books: monthBooks, audiobooks: monthAudiobooks });
    }

    const totalListeningSeconds = audiobooks.reduce((acc, a) => {
      if (a.duration && a.progress?.progress) {
        return acc + (a.duration * a.progress.progress / 100);
      }
      return acc;
    }, 0);

    const activityDates = new Set<string>();
    books.filter(b => b.progress?.lastReadAt).forEach(b => {
      if (!b.progress?.lastReadAt) return;
      const d = new Date(b.progress.lastReadAt);
      activityDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });
    audiobooks.filter(a => a.progress?.lastListenedAt).forEach(a => {
      if (!a.progress?.lastListenedAt) return;
      const d = new Date(a.progress.lastListenedAt);
      activityDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    });

    let readingStreak = 0;
    if (activityDates.size > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let checkDate = new Date(today);
      
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (!activityDates.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      while (true) {
        const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
        if (activityDates.has(dateStr)) {
          readingStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }
    }

    return {
      totalBooks: books.length,
      completedBooks: completedBooks.length,
      inProgressBooks: inProgressBooks.length,
      totalAudiobooks: audiobooks.length,
      completedAudiobooks: completedAudiobooks.length,
      inProgressAudiobooks: inProgressAudiobooks.length,
      readingStreak,
      totalReadingHours: 0,
      totalListeningHours: Math.round(totalListeningSeconds / 3600),
      booksThisMonth,
      booksThisYear,
      audiobooksThisMonth,
      audiobooksThisYear,
      topAuthors,
      topGenres,
      monthlyProgress,
    };
  })();

  const unreadBooks = Math.max(0, stats.totalBooks - stats.completedBooks - stats.inProgressBooks);
  const completionData = [
    { name: "Books Completed", value: stats.completedBooks },
    { name: "Books In Progress", value: stats.inProgressBooks },
    { name: "Books Unread", value: unreadBooks },
  ].filter(d => d.value > 0);

  const notStartedAudiobooks = Math.max(0, stats.totalAudiobooks - stats.completedAudiobooks - stats.inProgressAudiobooks);
  const audiobookCompletionData = [
    { name: "Completed", value: stats.completedAudiobooks },
    { name: "In Progress", value: stats.inProgressAudiobooks },
    { name: "Not Started", value: notStartedAudiobooks },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto bg-background texture-paper p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background texture-paper p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reading Statistics</h1>
            <p className="text-muted-foreground">Track your reading and listening progress</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Books Read"
            value={stats.completedBooks}
            description={`${stats.booksThisMonth} this month, ${stats.booksThisYear} this year`}
            icon={BookOpen}
          />
          <StatCard
            title="Audiobooks Finished"
            value={stats.completedAudiobooks}
            description={`${stats.audiobooksThisMonth} this month, ${stats.audiobooksThisYear} this year`}
            icon={Headphones}
          />
          <StatCard
            title="Listening Time"
            value={`${stats.totalListeningHours}h`}
            description="Total hours listened"
            icon={Clock}
          />
          <StatCard
            title="Reading Streak"
            value={`${stats.readingStreak} days`}
            description="Keep it up!"
            icon={Trophy}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Progress
              </CardTitle>
              <CardDescription>Books and audiobooks completed over the last 6 months</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyProgress}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs fill-muted-foreground" />
                  <YAxis className="text-xs fill-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px"
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="books" name="Books" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="audiobooks" name="Audiobooks" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Library Breakdown
              </CardTitle>
              <CardDescription>Current status of your library</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={completionData}
                    cx="50%"
                    cy="45%"
                    innerRadius={35}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {completionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px"
                    }} 
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-sm text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Authors</CardTitle>
              <CardDescription>Authors with the most items in your library</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topAuthors.length > 0 ? (
                <div className="space-y-4">
                  {stats.topAuthors.map((author, index) => (
                    <div key={author.name} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{author.name}</p>
                        <p className="text-xs text-muted-foreground">{author.count} items</p>
                      </div>
                      <div className="flex-shrink-0">
                        <div 
                          className="h-2 rounded-full bg-primary" 
                          style={{ width: `${Math.min(100, (author.count / (stats.topAuthors[0]?.count || 1)) * 100)}px` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No author data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top Tags/Genres</CardTitle>
              <CardDescription>Most common tags in your library</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.topGenres.length > 0 ? (
                <div className="space-y-4">
                  {stats.topGenres.map((genre, index) => (
                    <div key={genre.name} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary/10 text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{genre.name}</p>
                        <p className="text-xs text-muted-foreground">{genre.count} items</p>
                      </div>
                      <div className="flex-shrink-0">
                        <div 
                          className="h-2 rounded-full bg-secondary" 
                          style={{ width: `${Math.min(100, (genre.count / (stats.topGenres[0]?.count || 1)) * 100)}px` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No tag data available. Add tags to your items to see statistics.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Quick Summary</CardTitle>
            <CardDescription>Overview of your entire library</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalBooks}</p>
                  <p className="text-xs text-muted-foreground">Total Books</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Headphones className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.totalAudiobooks}</p>
                  <p className="text-xs text-muted-foreground">Total Audiobooks</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.inProgressBooks + stats.inProgressAudiobooks}</p>
                  <p className="text-xs text-muted-foreground">Currently Active</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{stats.completedBooks + stats.completedAudiobooks}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
