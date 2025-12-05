import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Moon, Timer, Car, List, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
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
import type { AudiobookWithProgress } from "@shared/schema";

// Chapter type matching server-side AudioChapter
interface Chapter {
  title: string;
  startTime: number;
  endTime?: number;
}

interface AudiobookPlayerProps {
  audiobook: AudiobookWithProgress;
  onClose: () => void;
  onProgressUpdate: (position: number, progress: number) => void;
  onCarModeOpen?: () => void;
}

// Sleep timer durations in minutes
const SLEEP_TIMER_OPTIONS = [
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "90 min", value: 90 },
];

// Extended playback rates
const PLAYBACK_RATES = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

export function AudiobookPlayer({ audiobook, onClose, onProgressUpdate, onCarModeOpen }: AudiobookPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(audiobook.progress?.lastPosition || 0);
  const [duration, setDuration] = useState(audiobook.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(audiobook.progress?.playbackRate || 1.0);
  
  // Sleep timer state
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState<number | null>(null);
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number>(0);
  const [stopAtChapterEnd, setStopAtChapterEnd] = useState(false);
  const [chapterEndTriggered, setChapterEndTriggered] = useState(false);
  const sleepTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fadeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastChapterIndexRef = useRef<number>(0);
  
  // Chapter state
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  
  // Parse chapters from audiobook data
  useEffect(() => {
    if (audiobook.chapters) {
      try {
        const parsedChapters = typeof audiobook.chapters === 'string' 
          ? JSON.parse(audiobook.chapters) 
          : audiobook.chapters;
        if (Array.isArray(parsedChapters)) {
          setChapters(parsedChapters);
        }
      } catch {
        // Invalid chapter data
        setChapters([]);
      }
    }
  }, [audiobook.chapters]);
  
  // Update current chapter based on playback position
  useEffect(() => {
    if (chapters.length === 0) return;
    
    // Find which chapter we're currently in
    let chapterIndex = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (currentTime >= chapters[i].startTime) {
        chapterIndex = i;
      } else {
        break;
      }
    }
    
    // Check if we've moved to a new chapter
    if (chapterIndex !== lastChapterIndexRef.current) {
      // If stop at chapter end is enabled and we just finished a chapter, stop playback
      if (stopAtChapterEnd && isPlaying && chapterIndex > lastChapterIndexRef.current && !chapterEndTriggered) {
        setChapterEndTriggered(true);
        fadeOutAndPause();
        // Don't reset stopAtChapterEnd - keep it enabled for next play session
      }
      lastChapterIndexRef.current = chapterIndex;
    }
    
    setCurrentChapterIndex(chapterIndex);
  }, [currentTime, chapters, stopAtChapterEnd, isPlaying, chapterEndTriggered, fadeOutAndPause]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.playbackRate = playbackRate;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      const progress = duration > 0 ? (audio.currentTime / duration) * 100 : 0;
      
      // Save progress every 10 seconds
      if (Math.floor(audio.currentTime) % 10 === 0) {
        onProgressUpdate(audio.currentTime, progress);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      if (audiobook.progress?.lastPosition) {
        audio.currentTime = audiobook.progress.lastPosition;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onProgressUpdate(0, 100);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [duration, volume, playbackRate, audiobook.progress, onProgressUpdate]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      // Reset chapter end trigger when resuming playback
      setChapterEndTriggered(false);
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
  };

  const cyclePlaybackRate = () => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    setPlaybackRate(PLAYBACK_RATES[nextIndex]);
  };

  const handlePlaybackRateChange = (value: string) => {
    setPlaybackRate(parseFloat(value));
  };

  // Sleep timer functions
  const startSleepTimer = useCallback((minutes: number) => {
    // Clear any existing timer
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
    }

    const endTime = Date.now() + minutes * 60 * 1000;
    setSleepTimerMinutes(minutes);
    setSleepTimerEndTime(endTime);
    setSleepTimerRemaining(minutes * 60);

    // Update remaining time every second
    sleepTimerIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);

      if (remaining <= 0) {
        // Timer expired - fade out and pause
        fadeOutAndPause();
      }
    }, 1000);
  }, []);

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    setSleepTimerMinutes(null);
    setSleepTimerEndTime(null);
    setSleepTimerRemaining(0);
  }, []);

  const fadeOutAndPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Fade out volume over 5 seconds
    const originalVolume = audio.volume;
    const fadeSteps = 50;
    const fadeInterval = 100; // 5 seconds total
    let currentStep = 0;

    fadeIntervalRef.current = setInterval(() => {
      currentStep++;
      const newVolume = originalVolume * (1 - currentStep / fadeSteps);
      audio.volume = Math.max(0, newVolume);

      if (currentStep >= fadeSteps) {
        if (fadeIntervalRef.current) {
          clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
        }
        audio.pause();
        audio.volume = originalVolume; // Restore volume for next play
        setIsPlaying(false);
        cancelSleepTimer();
      }
    }, fadeInterval);
  }, [cancelSleepTimer]);

  // Cleanup sleep timer on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerIntervalRef.current) {
        clearInterval(sleepTimerIntervalRef.current);
      }
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
      }
    };
  }, []);

  const formatSleepTimerRemaining = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Jump to a specific chapter
  const jumpToChapter = useCallback((chapterIndex: number) => {
    const audio = audioRef.current;
    if (!audio || !chapters[chapterIndex]) return;
    
    audio.currentTime = chapters[chapterIndex].startTime;
    setCurrentTime(chapters[chapterIndex].startTime);
    setChaptersOpen(false);
    
    // Auto-play when jumping to chapter
    if (!isPlaying) {
      audio.play();
      setIsPlaying(true);
    }
  }, [chapters, isPlaying]);

  // Skip to next chapter
  const nextChapter = useCallback(() => {
    if (chapters.length === 0) return;
    const nextIndex = Math.min(currentChapterIndex + 1, chapters.length - 1);
    jumpToChapter(nextIndex);
  }, [chapters.length, currentChapterIndex, jumpToChapter]);

  // Skip to previous chapter
  const previousChapter = useCallback(() => {
    if (chapters.length === 0) return;
    const prevIndex = Math.max(currentChapterIndex - 1, 0);
    jumpToChapter(prevIndex);
  }, [currentChapterIndex, jumpToChapter]);

  // Get current chapter info
  const currentChapter = chapters[currentChapterIndex];

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t shadow-2xl"
      role="region"
      aria-label={`Audio player: ${audiobook.title}`}
    >
      <audio ref={audioRef} src={audiobook.filePath} />
      
      <div className="container max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
          {/* Cover and Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {audiobook.coverUrl ? (
              <img
                src={audiobook.coverUrl}
                alt={`Cover for ${audiobook.title}`}
                className="h-16 w-16 rounded object-cover flex-shrink-0"
              />
            ) : (
              <div 
                className="h-16 w-16 rounded bg-muted flex items-center justify-center flex-shrink-0"
                role="img"
                aria-label={`No cover available for ${audiobook.title}`}
              >
                <span className="text-2xl" aria-hidden="true">🎧</span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">{audiobook.title}</h3>
              {audiobook.author && (
                <p className="text-xs text-muted-foreground truncate">{audiobook.author}</p>
              )}
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex-1 max-w-2xl space-y-2">
            <div className="flex items-center justify-center gap-2" role="group" aria-label="Playback controls">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-15)}
                data-testid="button-skip-back"
                aria-label="Skip back 15 seconds"
              >
                <SkipBack className="h-5 w-5" aria-hidden="true" />
              </Button>
              
              <Button
                size="icon"
                onClick={togglePlay}
                className="h-10 w-10"
                data-testid="button-play-pause"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5" aria-hidden="true" />
                )}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(15)}
                data-testid="button-skip-forward"
                aria-label="Skip forward 15 seconds"
              >
                <SkipForward className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums w-12 text-right" aria-hidden="true">
                {formatTime(currentTime)}
              </span>
              <Slider
                value={[currentTime]}
                max={duration}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
                data-testid="slider-progress"
                aria-label={`Playback position: ${formatTime(currentTime)} of ${formatTime(duration)}`}
              />
              <span className="text-xs text-muted-foreground tabular-nums w-12" aria-hidden="true">
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center gap-1 md:gap-2" role="group" aria-label="Secondary controls">
            {/* Playback Speed Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 gap-1"
                  data-testid="button-playback-speed"
                  aria-label={`Playback speed: ${playbackRate}x. Click to change.`}
                >
                  <Gauge className="h-4 w-4" aria-hidden="true" />
                  <span className="text-xs tabular-nums">{playbackRate}x</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-3" align="end">
                <div className="space-y-3">
                  <div className="text-sm font-medium">Playback Speed</div>
                  <div className="grid grid-cols-3 gap-1">
                    {PLAYBACK_RATES.map((rate) => (
                      <Button
                        key={rate}
                        variant={playbackRate === rate ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => setPlaybackRate(rate)}
                        data-testid={`button-speed-${rate}`}
                      >
                        {rate}x
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Sleep Timer */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={sleepTimerMinutes ? "secondary" : "ghost"}
                  size="icon"
                  className="h-8 w-8 relative"
                  data-testid="button-sleep-timer"
                  aria-label={sleepTimerMinutes ? `Sleep timer: ${formatSleepTimerRemaining(sleepTimerRemaining)} remaining` : "Set sleep timer"}
                >
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  {sleepTimerMinutes && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1 min-w-[16px] text-center">
                      {Math.ceil(sleepTimerRemaining / 60)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Sleep Timer</div>
                    {sleepTimerMinutes && (
                      <Badge variant="outline" className="text-xs">
                        {formatSleepTimerRemaining(sleepTimerRemaining)}
                      </Badge>
                    )}
                  </div>
                  
                  {sleepTimerMinutes ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Audio will fade out and pause when timer ends.
                      </p>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="w-full"
                        onClick={cancelSleepTimer}
                        data-testid="button-cancel-timer"
                      >
                        Cancel Timer
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-1">
                        {SLEEP_TIMER_OPTIONS.map((option) => (
                          <Button
                            key={option.value}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => startSleepTimer(option.value)}
                            data-testid={`button-timer-${option.value}`}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                      
                      {/* End of Chapter option */}
                      {chapters.length > 0 && (
                        <div className="flex items-center justify-between pt-2 border-t">
                          <Label htmlFor="stop-at-chapter" className="text-xs cursor-pointer">
                            Stop at end of chapter
                          </Label>
                          <Switch
                            id="stop-at-chapter"
                            checked={stopAtChapterEnd}
                            onCheckedChange={(checked) => {
                              setStopAtChapterEnd(checked);
                              setChapterEndTriggered(false);
                            }}
                            data-testid="switch-stop-at-chapter"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Chapter List */}
            {chapters.length > 0 && (
              <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 relative"
                    data-testid="button-chapters"
                    aria-label={`Chapters (${currentChapterIndex + 1}/${chapters.length})`}
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1 min-w-[16px] text-center">
                      {chapters.length}
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <List className="h-5 w-5" />
                      Chapters
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                    <div className="space-y-1 pr-4">
                      {chapters.map((chapter, index) => (
                        <button
                          key={index}
                          onClick={() => jumpToChapter(index)}
                          className={`w-full text-left p-3 rounded-md transition-colors ${
                            index === currentChapterIndex
                              ? "bg-primary/10 border border-primary/20"
                              : "hover:bg-muted"
                          }`}
                          data-testid={`button-chapter-${index}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-xs font-medium tabular-nums min-w-[24px] ${
                              index === currentChapterIndex ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm truncate ${
                                index === currentChapterIndex ? "font-medium" : ""
                              }`}>
                                {chapter.title}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatTime(chapter.startTime)}
                                {chapter.endTime && ` - ${formatTime(chapter.endTime)}`}
                              </p>
                            </div>
                            {index === currentChapterIndex && (
                              <Badge variant="default" className="text-[10px] h-5">
                                Playing
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            )}

            <div className="hidden md:flex items-center gap-2" role="group" aria-label="Volume controls">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMute}
                data-testid="button-mute"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              <Slider
                value={[volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-20"
                data-testid="slider-volume"
                aria-label={`Volume: ${Math.round(volume * 100)}%`}
              />
            </div>

            {/* Car Mode */}
            {onCarModeOpen && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onCarModeOpen}
                className="h-8 w-8"
                data-testid="button-car-mode"
                aria-label="Open Car Mode for distraction-free listening"
              >
                <Car className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              data-testid="button-close-player"
              aria-label="Close player"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
