import React, { useState, useEffect, useCallback, useRef } from 'react';
import { login, signup, logout, getCurrentUser } from './services/authService';
import { ChallengeStatus, ChallengeProgress, User } from './types';
import { CHALLENGES } from './constants';
import { initializeAi } from './services/ApiService';
import { audioSources } from './services/audioService';
import AuthScreen from './components/AuthScreen';
import ChallengeHost from './components/ChallengeHost';
import Spinner from './components/Spinner';

const PROGRESS_STORAGE_KEY = 'prompt-challenge-progress';
const MUTE_STORAGE_KEY = 'prompt-challenge-muted';

const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(getCurrentUser());
  const [isHidingAuth, setIsHidingAuth] = useState(false);
  
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      const savedState = localStorage.getItem(MUTE_STORAGE_KEY);
      return savedState ? JSON.parse(savedState) : false;
    } catch (e) {
      console.error("Failed to parse mute state from local storage", e);
      return false;
    }
  });
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  const [challengeProgress, setChallengeProgress] = useState<Record<number, ChallengeProgress>>({});
  const [streakChange, setStreakChange] = useState<'increase' | 'decrease' | 'none'>('none');
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const streakUpAudioRef = useRef<HTMLAudioElement>(null);
  const streakDownAudioRef = useRef<HTMLAudioElement>(null);
  const buttonClickAudioRef = useRef<HTMLAudioElement>(null);
  const loginAudioRef = useRef<HTMLAudioElement>(null);
  const levelCompleteAudioRef = useRef<HTMLAudioElement>(null);
  const similarityMeterAudioRef = useRef<HTMLAudioElement>(null);
  const scanningAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    // Initialize AI Service
    if (process.env.API_KEY) {
      try {
        initializeAi(process.env.API_KEY);
        setIsInitialized(true);
      } catch (e: any) {
        setError("Failed to initialize AI service: " + e.message);
        setIsInitialized(false);
      }
    } else {
      setError("CRITICAL ERROR: API_KEY environment variable not set. Application cannot function.");
      setIsInitialized(false);
    }

    // Load user progress
    try {
      const savedProgress = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (savedProgress) {
        setChallengeProgress(JSON.parse(savedProgress));
      } else {
        const initialProgress: Record<number, ChallengeProgress> = {};
        CHALLENGES.forEach((challenge, index) => {
          initialProgress[challenge.id] = {
            status: index === 0 ? ChallengeStatus.UNLOCKED : ChallengeStatus.LOCKED,
            streak: 0,
            previousSimilarityScore: 0,
          };
        });
        setChallengeProgress(initialProgress);
      }
    } catch (e) {
      console.error("Failed to parse progress from local storage", e);
      // Handle potential corrupted data by resetting progress
      const initialProgress: Record<number, ChallengeProgress> = {};
      CHALLENGES.forEach((challenge, index) => {
          initialProgress[challenge.id] = {
            status: index === 0 ? ChallengeStatus.UNLOCKED : ChallengeStatus.LOCKED,
            streak: 0,
            previousSimilarityScore: 0,
          };
        });
      setChallengeProgress(initialProgress);
    }
  }, []);

  // Persist progress to local storage whenever it changes
  useEffect(() => {
    if (Object.keys(challengeProgress).length > 0) {
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(challengeProgress));
    }
  }, [challengeProgress]);

  // Persist mute state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, JSON.stringify(isMuted));
    } catch (e) {
      console.error("Failed to save mute state to local storage", e);
    }
  }, [isMuted]);

  // Main audio control and visibility handler
  useEffect(() => {
    const audioElement = audioRef.current;
    if (!audioElement) return;

    audioElement.loop = true; // Ensure loop is set programmatically

    const onPlay = () => {
      setIsMusicPlaying(true);
      setAutoplayBlocked(false);
    };
    const onPause = () => setIsMusicPlaying(false);

    audioElement.addEventListener('play', onPlay);
    audioElement.addEventListener('pause', onPause);

    const attemptPlayback = () => {
      // Only attempt to play if the tab is visible, user is logged in, and not muted
      if (user && !isMuted && document.visibilityState === 'visible') {
        audioElement.volume = 0.3;
        const playPromise = audioElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name === 'NotAllowedError') {
              console.warn("Audio autoplay was prevented by the browser.");
              setAutoplayBlocked(true);
            }
          });
        }
      } else {
        audioElement.pause();
      }
    };

    // This handles resuming music when the tab becomes visible again
    const handleVisibilityChange = () => {
        attemptPlayback();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Initial attempt to play when component mounts or user/mute state changes
    attemptPlayback();

    return () => {
      audioElement.removeEventListener('play', onPlay);
      audioElement.removeEventListener('pause', onPause);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isMuted]);

  // Effect to handle unlocking audio after first user interaction if autoplay was blocked
  useEffect(() => {
    // If there's no block, no user, or music is already playing, we don't need these listeners.
    if (!autoplayBlocked || !user || isMusicPlaying) {
        return;
    }
  
    const unlockAudio = async () => {
      if (!isMuted && audioRef.current) {
        try {
          await audioRef.current.play();
          // If play() succeeds, the 'onPlay' event listener will handle state updates.
        } catch (err) {
          console.error("Failed to play audio on interaction.", err);
        }
      }
    };
  
    // Listen for the very first interaction, then these listeners are removed automatically.
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
  
    return () => {
      // Cleanup in case component unmounts before interaction
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, [autoplayBlocked, user, isMuted, isMusicPlaying]);

  // Control mute state for all SFX audio elements
  useEffect(() => {
    if (streakUpAudioRef.current) streakUpAudioRef.current.muted = isMuted;
    if (streakDownAudioRef.current) streakDownAudioRef.current.muted = isMuted;
    if (buttonClickAudioRef.current) buttonClickAudioRef.current.muted = isMuted;
    if (loginAudioRef.current) loginAudioRef.current.muted = isMuted;
    if (levelCompleteAudioRef.current) levelCompleteAudioRef.current.muted = isMuted;
    if (similarityMeterAudioRef.current) similarityMeterAudioRef.current.muted = isMuted;
    if (scanningAudioRef.current) scanningAudioRef.current.muted = isMuted;
  }, [isMuted]);

  // Play streak sound effects
  useEffect(() => {
    if (streakChange === 'increase') {
      streakUpAudioRef.current?.play().catch(console.warn);
    } else if (streakChange === 'decrease') {
      streakDownAudioRef.current?.play().catch(console.warn);
    }
    if (streakChange !== 'none') {
      const timer = setTimeout(() => setStreakChange('none'), 1000);
      return () => clearTimeout(timer);
    }
  }, [streakChange]);

  // Global click sound handler
  useEffect(() => {
    const playSound = () => {
      if (buttonClickAudioRef.current) {
        buttonClickAudioRef.current.currentTime = 0;
        buttonClickAudioRef.current.play().catch(console.warn);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button, [role="button"], select, a')) {
        playSound();
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const handleAuthSuccess = (loggedInUser: User) => {
    loginAudioRef.current?.play().catch(console.warn);
    setIsHidingAuth(true);
    setTimeout(() => {
      setUser(loggedInUser);
      setIsHidingAuth(false);
    }, 1000);
  };

  const handleLogin = async (email: string, password: string) => {
    const loggedInUser = await login(email, password);
    handleAuthSuccess(loggedInUser);
  };

  const handleSignup = async (email: string, password: string) => {
    const signedUpUser = await signup(email, password);
    handleAuthSuccess(signedUpUser);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  const handleToggleMute = useCallback(() => {
    // This function now only needs to toggle the user's intent.
    // The useEffects will handle the actual playback state.
    setIsMuted(prev => !prev);
  }, []);

  const pauseBgMusic = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resumeBgMusic = useCallback(() => {
    if (!isMuted && user) {
      audioRef.current?.play().catch(console.warn);
    }
  }, [isMuted, user]);

  const playSimilarityMeterSound = useCallback(() => {
    const audio = similarityMeterAudioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(console.warn);
    }
  }, []);

  const playLevelCompleteSound = useCallback(() => {
    levelCompleteAudioRef.current?.play().catch(console.warn);
  }, []);
  
  const playScanningSound = useCallback(() => {
    scanningAudioRef.current?.play().catch(console.warn);
  }, []);

  const stopScanningSound = useCallback(() => {
    if (scanningAudioRef.current) {
        scanningAudioRef.current.pause();
        scanningAudioRef.current.currentTime = 0;
    }
  }, []);

  if (!isInitialized) {
    return (
      <div className="fixed inset-0 bg-cyber-bg flex flex-col items-center justify-center text-cyber-dim p-4">
        {error ? (
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-display text-red-500">INITIALIZATION FAILED</h1>
            <p className="max-w-md bg-cyber-surface p-4 border border-red-500 rounded-md">{error}</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <Spinner />
            <p className="text-cyber-primary animate-flicker">INITIALIZING INTERFACE...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} src={audioSources.backgroundMusic} loop />
      <audio ref={streakUpAudioRef} src={audioSources.streakUp} />
      <audio ref={streakDownAudioRef} src={audioSources.streakDown} />
      <audio ref={buttonClickAudioRef} src={audioSources.buttonClick} />
      <audio ref={loginAudioRef} src={audioSources.loginSound} />
      <audio ref={levelCompleteAudioRef} src={audioSources.levelComplete} />
      <audio ref={similarityMeterAudioRef} src={audioSources.similarityMeter} />
      <audio ref={scanningAudioRef} src={audioSources.scanningSound} loop />
      
      {!user ? (
        <AuthScreen onLogin={handleLogin} onSignup={handleSignup} isHiding={isHidingAuth} />
      ) : (
        <ChallengeHost
          user={user}
          onLogout={handleLogout}
          isMuted={isMuted}
          isMusicPlaying={isMusicPlaying}
          onToggleMute={handleToggleMute}
          challengeProgress={challengeProgress}
          setChallengeProgress={setChallengeProgress}
          streakChange={streakChange}
          setStreakChange={setStreakChange}
          onPauseBgMusic={pauseBgMusic}
          onResumeBgMusic={resumeBgMusic}
          onPlaySimilarityMeterSound={playSimilarityMeterSound}
          onPlayLevelCompleteSound={playLevelCompleteSound}
          onPlayScanningSound={playScanningSound}
          onStopScanningSound={stopScanningSound}
        />
      )}
    </>
  );
};

export default App;