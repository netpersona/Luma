import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Play, Pause, SkipBack, SkipForward, X, Moon, Gauge, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import type { AudiobookWithProgress } from "@shared/schema";

const PLAYBACK_RATES = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export default function CarMode() {
  const [, params] = useRoute("/car-mode/:id");
  const [, setLocation] = useLocation();
  const audiobookId = params?.id;

  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const { data: audiobook, isLoading } = useQuery<AudiobookWithProgress>({
    queryKey: ["/api/audiobooks", audiobookId],
    enabled: !!audiobookId,
  });

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
    }
    setIsPlaying(!isPlaying);
    resetControlsTimeout();
  }, [isPlaying]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration, audio.currentTime + seconds));
    resetControlsTimeout();
  }, [duration]);

  const cyclePlaybackRate = useCallback(() => {
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate);
    const nextIndex = (currentIndex + 1) % PLAYBACK_RATES.length;
    setPlaybackRate(PLAYBACK_RATES[nextIndex]);
    resetControlsTimeout();
  }, [playbackRate]);

  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 5000);
  }, [isPlaying]);

  const handleScreenTap = useCallback(() => {
    if (!showControls) {
      setShowControls(true);
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  const handleExit = useCallback(() => {
    const audio = audioRef.current;
    if (audio && isPlaying) {
      audio.pause();
    }
    if (currentTime > 0) {
      const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
      saveProgress(currentTime, progress);
    }
    setLocation(`/audiobooks/${audiobookId}`);
  }, [audiobookId, isPlaying, currentTime, duration, setLocation]);

  useEffect(() => {
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
        case "j":
          e.preventDefault();
          skip(-30);
          break;
        case "ArrowRight":
        case "l":
          e.preventDefault();
          skip(30);
          break;
        case "Escape":
          handleExit();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, skip, handleExit]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white"></div>
      </div>
    );
  }

  if (!audiobook) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center gap-6 text-white">
        <p className="text-xl">Audiobook not found</p>
        <Button 
          variant="outline" 
          onClick={() => setLocation("/")}
          className="text-white border-white/30 hover:bg-white/10"
          data-testid="button-back-library"
        >
          Back to Library
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black text-white overflow-hidden select-none"
      onClick={handleScreenTap}
      data-testid="car-mode-container"
    >
      <audio ref={audioRef} src={audiobook.filePath} />
      
      {audiobook.coverUrl && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-2xl scale-110"
          style={{ backgroundImage: `url(${audiobook.coverUrl})` }}
        />
      )}
      
      <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/80" />
      
      <div className={`relative z-10 h-full flex flex-col transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}>
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleExit}
            className="h-10 w-10 sm:h-12 sm:w-12 text-white/80 hover:text-white hover:bg-white/10 flex-shrink-0"
            data-testid="button-exit-car-mode"
          >
            <X className="h-6 w-6 sm:h-8 sm:w-8" />
          </Button>
          
          <div className="text-center flex-1 px-2 sm:px-4 min-w-0">
            <h1 className="text-base sm:text-lg md:text-xl font-semibold truncate">
              {audiobook.title}
            </h1>
            {audiobook.author && (
              <p className="text-xs sm:text-sm text-white/70 truncate">
                {audiobook.author}
              </p>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={cyclePlaybackRate}
            className="h-10 sm:h-12 px-2 sm:px-4 text-white/80 hover:text-white hover:bg-white/10 flex-shrink-0"
            data-testid="button-car-speed"
          >
            <Gauge className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="text-base sm:text-lg tabular-nums">{playbackRate}x</span>
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="flex items-center gap-4 sm:gap-8 md:gap-12">
            <button
              onClick={(e) => { e.stopPropagation(); skip(-30); }}
              className="flex flex-col items-center gap-1 p-3 sm:p-4 md:p-6 rounded-full hover:bg-white/10 transition-colors active:scale-95"
              data-testid="button-car-skip-back"
            >
              <div className="relative">
                <SkipBack className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16" />
                <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold">
                  30
                </span>
              </div>
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all active:scale-95 shadow-2xl flex-shrink-0"
              data-testid="button-car-play-pause"
            >
              {isPlaying ? (
                <Pause className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16" />
              ) : (
                <Play className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16 ml-1 sm:ml-2" />
              )}
            </button>
            
            <button
              onClick={(e) => { e.stopPropagation(); skip(30); }}
              className="flex flex-col items-center gap-1 p-3 sm:p-4 md:p-6 rounded-full hover:bg-white/10 transition-colors active:scale-95"
              data-testid="button-car-skip-forward"
            >
              <div className="relative">
                <SkipForward className="h-10 w-10 sm:h-14 sm:w-14 md:h-16 md:w-16" />
                <span className="absolute inset-0 flex items-center justify-center text-xs sm:text-sm font-bold">
                  30
                </span>
              </div>
            </button>
          </div>
        </div>
        
        <div className="p-4 sm:p-6 md:p-8 space-y-3 sm:space-y-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="text-xs sm:text-sm text-white/70 tabular-nums w-12 sm:w-16 text-right">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 h-1.5 sm:h-2 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs sm:text-sm text-white/70 tabular-nums w-12 sm:w-16">
              {formatTime(duration)}
            </span>
          </div>
          
          <div className="flex items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-white/50">
            <span>Tap to show controls</span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">Space: Play/Pause</span>
            <span className="hidden md:inline">|</span>
            <span className="hidden md:inline">Arrow keys: Skip ±30s</span>
          </div>
        </div>
      </div>
    </div>
  );
}
