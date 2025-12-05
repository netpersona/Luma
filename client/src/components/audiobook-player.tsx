import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Moon, Timer, Car, List, Gauge, ChevronLeft, ChevronRight } from "lucide-react";
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
import type { AudiobookWithProgress, AudiobookTrack } from "@shared/schema";

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

export function AudiobookPlayer({ audiobook, onClose, onProgressUpdate, onCarModeOpen }: AudiobookPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audiobook.duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(audiobook.progress?.playbackRate || 1.0);
  
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
  
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [trackCurrentTime, setTrackCurrentTime] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);
  
  const wasPlayingRef = useRef(false);
  const pendingSeekRef = useRef<number | null>(null);
  
  const isMultiFile = audiobook.format === 'multi' && (audiobook.trackCount || 0) > 0;
  
  const { data: tracks = [] } = useQuery<AudiobookTrack[]>({
    queryKey: ['/api/audiobooks', audiobook.id, 'tracks'],
    enabled: isMultiFile,
  });
  
  const sortedTracks = [...tracks].sort((a, b) => a.trackIndex - b.trackIndex);
  const currentTrack = sortedTracks[currentTrackIndex];
  
  const totalDurationFromTracks = sortedTracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const effectiveDuration = isMultiFile ? totalDurationFromTracks : duration;
  
  const calculateOverallPosition = useCallback(() => {
    if (!isMultiFile) return currentTime;
    
    let position = 0;
    for (let i = 0; i < currentTrackIndex; i++) {
      position += sortedTracks[i]?.duration || 0;
    }
    position += trackCurrentTime;
    return position;
  }, [isMultiFile, currentTime, currentTrackIndex, trackCurrentTime, sortedTracks]);
  
  const seekToOverallPosition = useCallback((position: number) => {
    if (!isMultiFile) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = position;
        setCurrentTime(position);
      }
      return;
    }
    
    let accumulated = 0;
    for (let i = 0; i < sortedTracks.length; i++) {
      const trackDur = sortedTracks[i]?.duration || 0;
      if (accumulated + trackDur > position) {
        const trackPosition = position - accumulated;
        if (i !== currentTrackIndex) {
          pendingSeekRef.current = trackPosition;
          setCurrentTrackIndex(i);
        } else {
          const audio = audioRef.current;
          if (audio) {
            audio.currentTime = trackPosition;
            setTrackCurrentTime(trackPosition);
          }
        }
        return;
      }
      accumulated += trackDur;
    }
  }, [isMultiFile, sortedTracks, currentTrackIndex]);
  
  useEffect(() => {
    if (audiobook.progress?.lastPosition && !isMultiFile) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = audiobook.progress.lastPosition;
        setCurrentTime(audiobook.progress.lastPosition);
      }
    } else if (audiobook.progress?.lastPosition && isMultiFile && sortedTracks.length > 0) {
      seekToOverallPosition(audiobook.progress.lastPosition);
    }
  }, [audiobook.progress?.lastPosition, isMultiFile, sortedTracks.length, seekToOverallPosition]);
  
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
        setChapters([]);
      }
    }
  }, [audiobook.chapters]);
  
  const fadeOutAndPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const originalVolume = audio.volume;
    const fadeSteps = 50;
    const fadeInterval = 100;
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
        audio.volume = originalVolume;
        setIsPlaying(false);
        cancelSleepTimer();
      }
    }, fadeInterval);
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
  
  useEffect(() => {
    if (chapters.length === 0) return;
    
    const time = isMultiFile ? calculateOverallPosition() : currentTime;
    let chapterIndex = 0;
    for (let i = 0; i < chapters.length; i++) {
      if (time >= chapters[i].startTime) {
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
  }, [currentTime, chapters, stopAtChapterEnd, isPlaying, chapterEndTriggered, fadeOutAndPause, isMultiFile, calculateOverallPosition]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.playbackRate = playbackRate;

    const handleTimeUpdate = () => {
      if (isMultiFile) {
        setTrackCurrentTime(audio.currentTime);
        const overallPos = calculateOverallPosition();
        const progress = effectiveDuration > 0 ? (overallPos / effectiveDuration) * 100 : 0;
        
        if (Math.floor(audio.currentTime) % 10 === 0) {
          onProgressUpdate(overallPos, progress);
        }
      } else {
        setCurrentTime(audio.currentTime);
        const progress = duration > 0 ? (audio.currentTime / duration) * 100 : 0;
        
        if (Math.floor(audio.currentTime) % 10 === 0) {
          onProgressUpdate(audio.currentTime, progress);
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (isMultiFile) {
        setTrackDuration(audio.duration);
        if (pendingSeekRef.current !== null) {
          audio.currentTime = pendingSeekRef.current;
          setTrackCurrentTime(pendingSeekRef.current);
          pendingSeekRef.current = null;
          if (wasPlayingRef.current) {
            audio.play().catch(() => {});
          }
        }
      } else {
        setDuration(audio.duration);
        if (audiobook.progress?.lastPosition && audio.currentTime === 0) {
          audio.currentTime = audiobook.progress.lastPosition;
          setCurrentTime(audiobook.progress.lastPosition);
        }
      }
    };

    const handleEnded = () => {
      if (isMultiFile && currentTrackIndex < sortedTracks.length - 1) {
        setCurrentTrackIndex(prev => prev + 1);
      } else {
        setIsPlaying(false);
        onProgressUpdate(0, 100);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [duration, volume, playbackRate, onProgressUpdate, isMultiFile, currentTrackIndex, sortedTracks.length, effectiveDuration, calculateOverallPosition]);

  useEffect(() => {
    if (isMultiFile && currentTrack) {
      const audio = audioRef.current;
      if (audio) {
        wasPlayingRef.current = isPlaying;
        if (pendingSeekRef.current !== null) {
          audio.load();
        } else {
          audio.load();
          if (wasPlayingRef.current) {
            audio.play().catch(() => {});
          }
        }
      }
    }
  }, [currentTrackIndex, isMultiFile, currentTrack]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
      setChapterEndTriggered(false);
    }
    setIsPlaying(!isPlaying);
  };

  const skip = (seconds: number) => {
    if (isMultiFile) {
      const currentPos = calculateOverallPosition();
      const newPos = Math.max(0, Math.min(effectiveDuration, currentPos + seconds));
      seekToOverallPosition(newPos);
    } else {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
    }
  };

  const handleSeek = (value: number[]) => {
    seekToOverallPosition(value[0]);
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

  const handlePlaybackRateChange = (value: string) => {
    setPlaybackRate(parseFloat(value));
  };

  const startSleepTimer = useCallback((minutes: number) => {
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

    sleepTimerIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSleepTimerRemaining(remaining);

      if (remaining <= 0) {
        fadeOutAndPause();
      }
    }, 1000);
  }, [fadeOutAndPause]);

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

  const jumpToChapter = useCallback((chapterIndex: number) => {
    const chapter = chapters[chapterIndex];
    if (!chapter) return;
    
    seekToOverallPosition(chapter.startTime);
    setChaptersOpen(false);
    
    if (!isPlaying) {
      const audio = audioRef.current;
      if (audio) {
        audio.play();
        setIsPlaying(true);
      }
    }
  }, [chapters, isPlaying, seekToOverallPosition]);

  const jumpToTrack = useCallback((trackIndex: number) => {
    if (!isMultiFile || trackIndex < 0 || trackIndex >= sortedTracks.length) return;
    
    setCurrentTrackIndex(trackIndex);
    setTrackCurrentTime(0);
    
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      if (!isPlaying) {
        audio.play();
        setIsPlaying(true);
      }
    }
    setChaptersOpen(false);
  }, [isMultiFile, sortedTracks.length, isPlaying]);

  const nextTrack = useCallback(() => {
    if (isMultiFile && currentTrackIndex < sortedTracks.length - 1) {
      jumpToTrack(currentTrackIndex + 1);
    }
  }, [isMultiFile, currentTrackIndex, sortedTracks.length, jumpToTrack]);

  const previousTrack = useCallback(() => {
    if (isMultiFile && currentTrackIndex > 0) {
      jumpToTrack(currentTrackIndex - 1);
    }
  }, [isMultiFile, currentTrackIndex, jumpToTrack]);

  const currentChapter = chapters[currentChapterIndex];
  const overallPosition = isMultiFile ? calculateOverallPosition() : currentTime;

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const audioSrc = isMultiFile && currentTrack ? currentTrack.filePath : audiobook.filePath;

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t shadow-2xl"
      role="region"
      aria-label={`Audio player: ${audiobook.title}`}
    >
      <audio ref={audioRef} src={audioSrc} />
      
      <div className="container max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center gap-4">
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
              {isMultiFile && currentTrack ? (
                <p className="text-xs text-muted-foreground truncate">
                  Track {currentTrackIndex + 1}/{sortedTracks.length}: {currentTrack.title}
                </p>
              ) : audiobook.author ? (
                <p className="text-xs text-muted-foreground truncate">{audiobook.author}</p>
              ) : null}
            </div>
          </div>

          <div className="flex-1 max-w-2xl space-y-2">
            <div className="flex items-center justify-center gap-2" role="group" aria-label="Playback controls">
              {isMultiFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={previousTrack}
                  disabled={currentTrackIndex === 0}
                  data-testid="button-previous-track"
                  aria-label="Previous track"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </Button>
              )}
              
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
              
              {isMultiFile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={nextTrack}
                  disabled={currentTrackIndex >= sortedTracks.length - 1}
                  data-testid="button-next-track"
                  aria-label="Next track"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums w-12 text-right" aria-hidden="true">
                {formatTime(overallPosition)}
              </span>
              <Slider
                value={[overallPosition]}
                max={effectiveDuration}
                step={1}
                onValueChange={handleSeek}
                className="flex-1"
                data-testid="slider-progress"
                aria-label={`Playback position: ${formatTime(overallPosition)} of ${formatTime(effectiveDuration)}`}
              />
              <span className="text-xs text-muted-foreground tabular-nums w-12" aria-hidden="true">
                {formatTime(effectiveDuration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2" role="group" aria-label="Secondary controls">
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

            {(chapters.length > 0 || (isMultiFile && sortedTracks.length > 0)) && (
              <Sheet open={chaptersOpen} onOpenChange={setChaptersOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 relative"
                    data-testid="button-chapters"
                    aria-label={isMultiFile 
                      ? `Tracks (${currentTrackIndex + 1}/${sortedTracks.length})`
                      : `Chapters (${currentChapterIndex + 1}/${chapters.length})`
                    }
                  >
                    <List className="h-4 w-4" aria-hidden="true" />
                    <span className="absolute -top-1 -right-1 text-[10px] bg-muted text-muted-foreground rounded-full px-1 min-w-[16px] text-center">
                      {isMultiFile ? sortedTracks.length : chapters.length}
                    </span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <List className="h-5 w-5" />
                      {isMultiFile ? 'Tracks' : 'Chapters'}
                    </SheetTitle>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-100px)] mt-4">
                    <div className="space-y-1 pr-4">
                      {isMultiFile ? (
                        sortedTracks.map((track, index) => (
                          <button
                            key={track.id}
                            onClick={() => jumpToTrack(index)}
                            className={`w-full text-left p-3 rounded-md transition-colors ${
                              index === currentTrackIndex
                                ? "bg-primary/10 border border-primary/20"
                                : "hover:bg-muted"
                            }`}
                            data-testid={`button-track-${index}`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`text-xs font-medium tabular-nums min-w-[24px] ${
                                index === currentTrackIndex ? "text-primary" : "text-muted-foreground"
                              }`}>
                                {index + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${
                                  index === currentTrackIndex ? "font-medium" : ""
                                }`}>
                                  {track.title}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {formatTime(track.duration || 0)}
                                </p>
                              </div>
                              {index === currentTrackIndex && (
                                <Badge variant="default" className="text-[10px] h-5">
                                  Playing
                                </Badge>
                              )}
                            </div>
                          </button>
                        ))
                      ) : (
                        chapters.map((chapter, index) => (
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
                        ))
                      )}
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
