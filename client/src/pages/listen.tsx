import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  X, 
  Moon, 
  Timer, 
  Car, 
  List, 
  Gauge,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import type { AudiobookWithProgress } from "@shared/schema";

interface Chapter {
  title: string;
  startTime: number;
  endTime?: number;
}

const SLEEP_TIMER_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export default function Listen() {
  const [, params] = useRoute("/listen/:id");
  const [, setLocation] = useLocation();
  const audiobookId = params?.id;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number>(0);
  const [stopAtChapterEnd, setStopAtChapterEnd] = useState(false);
  const [chapterEndTriggered, setChapterEndTriggered] = useState(false);
  const sleepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChapterIndexRef = useRef<number>(0);
  
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [chaptersOpen, setChaptersOpen] = useState(false);

  const { data: audiobook, isLoading } = useQuery<AudiobookWithProgress>({
    queryKey: ["/api/audiobooks", audiobookId],
    enabled: !!audiobookId,
  });

  useEffect(() => {
    if (audiobook?.chapters) {
      try {
        const parsedChapters = typeof audiobook.chapters === 'string' 
          ? JSON.parse(audiobook.chapters) 
          : audiobook.chapters;
        if (Array.isArray(parsedChapters)) {
          setChapters(parsedChapters);
        }
      } catch {
        setChapters([]);
      }
    }
  }, [audiobook?.chapters]);

  useEffect(() => {
    if (audiobook?.progress?.playbackRate) {
      setPlaybackRate(audiobook.progress.playbackRate);
    }
  }, [audiobook?.progress?.playbackRate]);

  const fadeOutAndPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const startVolume = audio.volume;
    const fadeSteps = 20;
    const fadeInterval = 50;
    let step = 0;
    
    fadeIntervalRef.current = setInterval(() => {
      step++;
      audio.volume = Math.max(0, startVolume * (1 - step / fadeSteps));
      
      if (step >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
        }
        audio.pause();
        setIsPlaying(false);
        audio.volume = startVolume;
        setSleepTimerMinutes(null);
        setSleepTimerEndTime(null);
        setSleepTimerRemaining(0);
      }
    }, fadeInterval);
  }, []);

  useEffect(() => {
    if (chapters.length === 0) return;
    
    let chapterIndex = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (currentTime >= chapters[i].startTime) {
        chapterIndex = i;
      } else {
        break;
      }
    }
    
    if (chapterIndex !== lastChapterIndexRef.current) {
      if (stopAtChapterEnd && isPlaying && chapterIndex > lastChapterIndexRef.current && !chapterEndTriggered) {
        setChapterEndTriggered(true);
        fadeOutAndPause();
      }
      lastChapterIndexRef.current = chapterIndex;
    }
    
    setCurrentChapterIndex(chapterIndex);
  }, [currentTime, chapters, stopAtChapterEnd, isPlaying, chapterEndTriggered, fadeOutAndPause]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.playbackRate = playbackRate;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      
      if (Math.floor(audio.currentTime) % 10 === 0 && audio.currentTime > 0) {
        const progress = duration > 0 ? (audio.currentTime / duration) * 100 : 0;
        saveProgress(audio.currentTime, progress);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      if (audiobook?.progress?.lastPosition) {
        audio.currentTime = audiobook.progress.lastPosition;
        setCurrentTime(audiobook.progress.lastPosition);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      saveProgress(0, 100);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [duration, playbackRate, audiobook?.progress?.lastPosition]);

  useEffect(() => {
    if (sleepTimerEndTime) {
      sleepTimerIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, sleepTimerEndTime - Date.now());
        setSleepTimerRemaining(remaining);
        
        if (remaining <= 0) {
          fadeOutAndPause();
          if (sleepTimerIntervalRef.current) {
            clearInterval(sleepTimerIntervalRef.current);
          }
        }
      }, 1000);
      
      return () => {
        if (sleepTimerIntervalRef.current) {
          clearInterval(sleepTimerIntervalRef.current);
        }
      };
    }
  }, [sleepTimerEndTime, fadeOutAndPause]);

  const saveProgress = async (position: number, progress: number) => {
    if (!audiobookId) return;
    try {
      await apiRequest("PATCH", `/api/audiobooks/${audiobookId}/progress`, {
        lastPosition: position,
        progress: progress,
        playbackRate: playbackRate,
      });
    } catch (error) {
      console.error("Failed to save progress:", error);
    }
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      if (chapterEndTriggered) {
        setChapterEndTriggered(false);
      }
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying, chapterEndTriggered]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  }, [duration]);

  const skipToChapter = useCallback((chapterIndex: number) => {
    const audio = audioRef.current;
    if (!audio || chapterIndex < 0 || chapterIndex >= chapters.length) return;
    
    audio.currentTime = chapters[chapterIndex].startTime;
    setCurrentTime(chapters[chapterIndex].startTime);
    setChaptersOpen(false);
  }, [chapters]);

  const nextChapter = useCallback(() => {
    if (currentChapterIndex < chapters.length - 1) {
      skipToChapter(currentChapterIndex + 1);
    }
  }, [currentChapterIndex, chapters.length, skipToChapter]);

  const previousChapter = useCallback(() => {
    if (currentChapterIndex > 0) {
      skipToChapter(currentChapterIndex - 1);
    }
  }, [currentChapterIndex, skipToChapter]);

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
      } else {
        audioRef.current.volume = 0;
      }
      setIsMuted(!isMuted);
    }
  };

  const handleSeek = (values: number[]) => {
    const newTime = values[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  const startSleepTimer = (minutes: number) => {
    setSleepTimerMinutes(minutes);
    setSleepTimerEndTime(Date.now() + minutes * 60 * 1000);
    setSleepTimerRemaining(minutes * 60 * 1000);
  };

  const cancelSleepTimer = () => {
    setSleepTimerMinutes(null);
    setSleepTimerEndTime(null);
    setSleepTimerRemaining(0);
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
    }
  };

  const handleClose = () => {
    const audio = audioRef.current;
    if (audio && isPlaying) {
      audio.pause();
    }
    if (currentTime > 0) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      saveProgress(currentTime, progress);
    }
    setLocation(`/audiobooks/${audiobookId}`);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimerRemaining = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4">
        <p className="text-muted-foreground">Audiobook not found</p>
        <Button onClick={() => setLocation("/")} data-testid="button-back-to-library">
          Back to Library
        </Button>
      </div>
    );
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentChapter = chapters[currentChapterIndex];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <audio
        ref={audioRef}
        src={audiobook.filePath}
        preload="metadata"
      />

      <div className="flex items-center justify-between p-4 border-b">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleClose}
          data-testid="button-close-player"
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/car-mode/${audiobookId}`)}
            data-testid="button-car-mode"
          >
            <Car className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-8">
        <div className="relative w-64 h-64 md:w-80 md:h-80">
          {audiobook.coverUrl ? (
            <img
              src={audiobook.coverUrl}
              alt={audiobook.title}
              className="w-full h-full object-cover rounded-lg shadow-2xl"
            />
          ) : (
            <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
              <span className="text-6xl text-muted-foreground">🎧</span>
            </div>
          )}
        </div>

        <div className="text-center max-w-lg">
          <h1 className="text-2xl font-bold mb-2" data-testid="text-audiobook-title">
            {audiobook.title}
          </h1>
          <p className="text-muted-foreground" data-testid="text-audiobook-author">
            {audiobook.author}
          </p>
          {audiobook.narrator && (
            <p className="text-sm text-muted-foreground">
              Narrated by {audiobook.narrator}
            </p>
          )}
          {currentChapter && (
            <Badge variant="secondary" className="mt-2">
              {currentChapter.title}
            </Badge>
          )}
        </div>

        <div className="w-full max-w-2xl space-y-2">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={handleSeek}
            className="cursor-pointer"
            data-testid="slider-progress"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span data-testid="text-current-time">{formatTime(currentTime)}</span>
            <span data-testid="text-remaining-time">-{formatTime(duration - currentTime)}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {chapters.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={previousChapter}
              disabled={currentChapterIndex === 0}
              data-testid="button-previous-chapter"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(-30)}
            data-testid="button-skip-back"
          >
            <SkipBack className="h-6 w-6" />
          </Button>
          
          <Button
            size="lg"
            className="h-16 w-16 rounded-full"
            onClick={togglePlay}
            data-testid="button-play-pause"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => skip(30)}
            data-testid="button-skip-forward"
          >
            <SkipForward className="h-6 w-6" />
          </Button>

          {chapters.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={nextChapter}
              disabled={currentChapterIndex === chapters.length - 1}
              data-testid="button-next-chapter"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              data-testid="button-mute"
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-24"
              data-testid="slider-volume"
            />
          </div>

          <Select
            value={playbackRate.toString()}
            onValueChange={(value) => setPlaybackRate(parseFloat(value))}
          >
            <SelectTrigger className="w-20" data-testid="select-playback-rate">
              <Gauge className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYBACK_RATES.map((rate) => (
                <SelectItem key={rate} value={rate.toString()}>
                  {rate}x
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-sleep-timer">
                <Moon className="h-4 w-4 mr-2" />
                {sleepTimerMinutes ? formatTimerRemaining(sleepTimerRemaining) : "Sleep"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56">
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Sleep Timer</h4>
                {sleepTimerMinutes ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Stopping in {formatTimerRemaining(sleepTimerRemaining)}
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={cancelSleepTimer}
                      data-testid="button-cancel-sleep-timer"
                    >
                      Cancel Timer
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {SLEEP_TIMER_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant="outline"
                        size="sm"
                        onClick={() => startSleepTimer(option.value)}
                        data-testid={`button-sleep-timer-${option.value}`}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="stop-at-chapter" className="text-sm">
                      Stop at chapter end
                    </Label>
                    <Switch
                      id="stop-at-chapter"
                      checked={stopAtChapterEnd}
                      onCheckedChange={setStopAtChapterEnd}
                      data-testid="switch-stop-at-chapter"
                    />
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {chapters.length > 0 && (
            <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-chapters">
                  <List className="h-4 w-4 mr-2" />
                  Chapters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Chapters</SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                  <div className="space-y-1">
                    {chapters.map((chapter, index) => (
                      <button
                        key={index}
                        onClick={() => skipToChapter(index)}
                        className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors ${
                          index === currentChapterIndex ? "bg-accent" : ""
                        }`}
                        data-testid={`button-chapter-${index}`}
                      >
                        <div className="font-medium text-sm">{chapter.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatTime(chapter.startTime)}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>

      <div className="p-4 border-t">
        <Progress value={progress} className="h-1" data-testid="progress-bar" />
      </div>
    </div>
  );
}
