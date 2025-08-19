
import React, { useState, useEffect, useCallback } from 'react';
import { Challenge, ChallengeStatus, AnalysisResult } from './types';
import { CHALLENGES, PASS_THRESHOLD } from './constants';
import ChallengeSelector from './components/ChallengeSelector';
import ChallengeView from './components/ChallengeView';
import { generateImage, analyzeImages, initializeAi, ImageService } from './services/ApiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSave: (apiKey: string) => void;
  onClose: () => void;
  isClosable: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onSave, onClose, isClosable }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // Reset local state when the modal is closed/opened
    if (!isOpen) {
      setApiKey('');
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isClosable && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-dark bg-opacity-90 flex items-center justify-center z-50 animate-fade-in" onClick={handleBackdropClick}>
      <div className="bg-gray-medium rounded-lg shadow-2xl p-8 w-full max-w-md space-y-6 transform animate-slide-in-up relative">
        {isClosable && (
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-light hover:text-white transition-colors" aria-label="Close modal">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        <h2 className="text-2xl font-bold text-white text-center">{isClosable ? 'Change API Key' : 'Enter Your Gemini API Key'}</h2>
        
        <div className="aspect-video bg-gray-dark rounded-md flex items-center justify-center">
          <svg className="w-16 h-16 text-gray-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
          </svg>
        </div>

        <p className="text-sm text-gray-light text-center">
          To use this application, you need a paid Google Gemini API key. You can get one from Google AI Studio. For image generation, you need an API Key from a paid project. The key will be stored in your browser's local storage.
        </p>

        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-light mb-1">
            Gemini API Key
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your **paid** Gemini API key here"
            className="w-full p-3 bg-gray-dark rounded-lg border-2 border-gray-medium focus:border-brand-primary focus:ring-brand-primary focus:outline-none transition-colors"
            required
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!apiKey.trim()}
          className="w-full py-3 px-6 bg-brand-primary hover:bg-brand-secondary text-white font-bold rounded-lg transition-all duration-300 disabled:bg-gray-500 disabled:cursor-not-allowed transform hover:scale-105 active:scale-100"
        >
          {isClosable ? 'Save Key' : 'Save and Continue'}
        </button>
      </div>
    </div>
  );
};


const App: React.FC = () => {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [challengeStatuses, setChallengeStatuses] = useState<ChallengeStatus[]>([]);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState<number>(0);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ImageService>('pollinations');

  useEffect(() => {
    // Check for API key and initialize
    const savedKey = localStorage.getItem('gemini-api-key');
    if (savedKey) {
      initializeAi(savedKey);
      setIsInitialized(true);
    } else if (process.env.API_KEY) {
      initializeAi(process.env.API_KEY);
      setIsInitialized(true);
    } else {
      setIsModalOpen(true);
    }

    // Load challenge progress
    try {
      const savedProgress = localStorage.getItem('prompt-challenge-progress');
      if (savedProgress) {
        const statuses = JSON.parse(savedProgress) as ChallengeStatus[];
        setChallengeStatuses(statuses);
        const lastCompleted = statuses.lastIndexOf(ChallengeStatus.COMPLETED);
        const nextChallenge = lastCompleted + 1;
        setCurrentChallengeIndex(nextChallenge < CHALLENGES.length ? nextChallenge : lastCompleted);
      } else {
        const initialStatuses = Array(CHALLENGES.length).fill(ChallengeStatus.LOCKED);
        initialStatuses[0] = ChallengeStatus.UNLOCKED;
        setChallengeStatuses(initialStatuses);
      }
    } catch (e) {
      console.error("Failed to parse progress from local storage", e);
      const initialStatuses = Array(CHALLENGES.length).fill(ChallengeStatus.LOCKED);
      initialStatuses[0] = ChallengeStatus.UNLOCKED;
      setChallengeStatuses(initialStatuses);
    }
  }, []);

  useEffect(() => {
    if(challengeStatuses.length > 0) {
      localStorage.setItem('prompt-challenge-progress', JSON.stringify(challengeStatuses));
    }
  }, [challengeStatuses]);
  
  const handleGenerateAndAnalyze = useCallback(async () => {
    if (!prompt) {
      setError("Prompt cannot be empty.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);
    setGeneratedImage(null);

    try {
      setLoadingMessage('Generating your masterpiece...');
      const imageB64 = await generateImage(prompt, selectedService);
      setGeneratedImage(`data:image/jpeg;base64,${imageB64}`);

      setLoadingMessage('Analyzing visual similarity...');
      const currentChallenge = CHALLENGES[currentChallengeIndex];
      const result = await analyzeImages(currentChallenge, imageB64);
      setAnalysisResult(result);

      if (result.similarityScore >= PASS_THRESHOLD) {
        setChallengeStatuses(prev => {
          const newStatuses = [...prev];
          newStatuses[currentChallengeIndex] = ChallengeStatus.COMPLETED;
          if (currentChallengeIndex + 1 < CHALLENGES.length) {
            newStatuses[currentChallengeIndex + 1] = ChallengeStatus.UNLOCKED;
          }
          return newStatuses;
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  }, [prompt, currentChallengeIndex, selectedService]);

  const handleSelectChallenge = (index: number) => {
    if (challengeStatuses[index] !== ChallengeStatus.LOCKED) {
      setCurrentChallengeIndex(index);
      setPrompt('');
      setGeneratedImage(null);
      setAnalysisResult(null);
      setError(null);
    }
  };

  const handleNextChallenge = () => {
    const nextIndex = currentChallengeIndex + 1;
    if (nextIndex < CHALLENGES.length) {
      handleSelectChallenge(nextIndex);
    }
  };
  
  const handleSaveApiKey = (key: string) => {
    if (key) {
      localStorage.setItem('gemini-api-key', key);
      try {
        initializeAi(key);
        setIsModalOpen(false);
        setIsInitialized(true);
      } catch (err: any) {
        // If initialization fails, keep the modal open but show an error.
        setError(err.message);
      }
    }
  };

  const currentChallenge = CHALLENGES[currentChallengeIndex];

  return (
    <>
      <ApiKeyModal
        isOpen={isModalOpen}
        onSave={handleSaveApiKey}
        onClose={() => setIsModalOpen(false)}
        isClosable={isInitialized}
      />
      {isInitialized && (
        <div className="min-h-screen bg-gray-dark font-sans text-gray-light">
          <header className="py-4 px-8 bg-gray-medium/30 border-b border-gray-medium flex justify-between items-center">
            <h1 className="text-3xl font-bold text-white tracking-wider">
              <span className="text-brand-primary">Prompt</span> Engineering Challenge
            </h1>
            <div className="flex items-center gap-4">
              <select
                id="image-service"
                value={selectedService}
                onChange={e => setSelectedService(e.target.value as ImageService)}
                className="py-2 px-4  rounded-lg bg-gray-medium hover:bg-gray-dark text-white text-sm font-semibold transition-colors border-0 focus:outline-none"
              >
                <option value="pollinations">Pollinations AI</option>
                <option value="gemini">Gemini</option>
              </select>
              <button
                onClick={() => setIsModalOpen(true)}
                className="py-2 px-4 bg-gray-medium hover:bg-gray-light/20 text-white text-sm font-semibold rounded-lg transition-colors"
                aria-label="Change API Key"
              >
                Change API Key
              </button>
            </div>
          </header>
          <main className="flex flex-col md:flex-row p-4 md:p-8 gap-8">
            <aside className="w-full md:w-1/4 lg:w-1/5">
              <ChallengeSelector
                challenges={CHALLENGES}
                statuses={challengeStatuses}
                currentChallengeId={currentChallenge.id}
                onSelectChallenge={handleSelectChallenge}
              />
            </aside>
            <div className="flex-1">
              {currentChallenge && (
                <ChallengeView
                  challenge={currentChallenge}
                  prompt={prompt}
                  onPromptChange={setPrompt}
                  onGenerate={handleGenerateAndAnalyze}
                  isLoading={isLoading}
                  loadingMessage={loadingMessage}
                  generatedImage={generatedImage}
                  analysisResult={analysisResult}
                  error={error}
                  onNextChallenge={handleNextChallenge}
                  isPassed={!!analysisResult && analysisResult.similarityScore >= PASS_THRESHOLD}
                />
              )}
            </div>
          </main>
        </div>
      )}
    </>
  );
};

export default App;
