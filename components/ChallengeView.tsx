import React, { useState, useEffect } from 'react';
import { Challenge, AnalysisResult } from '../types';
import Spinner from './Spinner';
import { getLocalImageAsBlobUrl } from '../services/analysisService';
import SimilarityMeter from './SimilarityMeter';

interface ChallengeViewProps {
  challenge: Challenge;
  prompt: string;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  isLoading: boolean;
  loadingMessage: string;
  generatedImage: string | null;
  analysisResult: AnalysisResult | null;
  error: string | null;
  onNextChallenge: () => void;
  isPassed: boolean;
  isNextChallengeAvailable: boolean;
  previousSimilarityScore: number;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
}

const HudFrame: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => (
    <div className="space-y-2">
        <h3 className="text-lg font-display font-bold text-center text-cyber-primary tracking-widest uppercase">{title}</h3>
        <div className="aspect-square bg-cyber-bg p-1 relative rounded-md">
            <div className="absolute inset-0 border-2 border-cyber-primary/30 rounded-md animate-border-flicker"></div>
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {children}
            </div>
             {/* Corner brackets */}
            <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-cyber-primary animate-pulse-corners"></div>
            <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-cyber-primary animate-pulse-corners"></div>
            <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-cyber-primary animate-pulse-corners"></div>
            <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-cyber-primary animate-pulse-corners"></div>
        </div>
    </div>
);

const ChallengeView: React.FC<ChallengeViewProps> = ({
  challenge,
  prompt,
  onPromptChange,
  onGenerate,
  isLoading,
  loadingMessage,
  generatedImage,
  analysisResult,
  error,
  onNextChallenge,
  isPassed,
  isNextChallengeAvailable,
  previousSimilarityScore,
  isSpeaking,
  onStopSpeaking,
}) => {
  const [targetImageSrc, setTargetImageSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    
    const loadImage = async () => {
      setTargetImageSrc(null); // Show loading state
      const blobUrl = await getLocalImageAsBlobUrl(challenge.imageUrl);
      
      if (blobUrl.startsWith('blob:')) {
        objectUrl = blobUrl;
      }
      setTargetImageSrc(blobUrl);
    };

    loadImage();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [challenge.imageUrl]);

  useEffect(() => {
    // Cleanup function to stop speaking when the component unmounts
    // or when the analysisResult changes (which would hide the feedback section).
    return () => {
      if (isSpeaking) {
        onStopSpeaking();
      }
    };
  }, [analysisResult, isSpeaking, onStopSpeaking]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-display font-bold text-white tracking-wider">{`CHALLENGE ${challenge.id}: ${challenge.name}`}</h2>
        <p className="text-cyber-dim mt-1 font-sans">{challenge.description}</p>
      </div>

      <div className="relative">
        <div className="pr-16 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HudFrame title="TARGET">
                 {targetImageSrc ? (
                  <img src={targetImageSrc} alt="Target for the challenge" className="w-full h-full object-cover" />
                ) : (
                  <Spinner />
                )}
            </HudFrame>
            <HudFrame title="GENERATION">
                {isLoading ? (
                  <div className="text-center">
                    <Spinner />
                    <p className="mt-2 text-cyber-primary animate-flicker font-bold tracking-widest">{loadingMessage}</p>
                  </div>
                ) : generatedImage ? (
                  <img src={generatedImage} alt="AI generated image" className="w-full h-full object-cover" />
                ) : (
                  <p className="text-cyber-dim">Awaiting image synthesis...</p>
                )}
            </HudFrame>
          </div>

          <div className="space-y-4">
            <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => onPromptChange(e.target.value)}
                  placeholder="Enter prompt here..."
                  className="w-full h-28 p-3 bg-cyber-surface/80 rounded-md border-2 border-cyber-secondary/50 focus:border-cyber-secondary focus:ring-2 focus:ring-cyber-secondary/50 focus:outline-none transition-all text-cyber-text placeholder:text-cyber-dim font-sans"
                  disabled={isLoading}
                />
                {isLoading && (
                  <div className="absolute inset-0 rounded-md overflow-hidden pointer-events-none">
                    <div className="scanner-bar"></div>
                  </div>
                )}
            </div>
            <button
              onClick={onGenerate}
              disabled={isLoading || !prompt}
              className="glitch-button w-full py-3 px-6 bg-cyber-primary text-cyber-bg font-bold text-lg rounded-md transition-all duration-300 disabled:bg-cyber-dim disabled:cursor-not-allowed transform hover:scale-105 active:scale-100 hover:shadow-lg hover:shadow-cyber-primary/50"
              data-text={isLoading ? 'Processing...' : 'GENERATE & ANALYZE'}
            >
              {isLoading ? 'Processing...' : 'GENERATE & ANALYZE'}
            </button>
            {error && <p className="text-red-400 text-center">{error}</p>}
          </div>
        </div>

        <SimilarityMeter score={analysisResult?.similarityScore ?? previousSimilarityScore} />
      </div>


      {analysisResult && (
        <div className="bg-cyber-surface/70 p-6 rounded-lg border-2 border-cyber-primary/30 animate-slide-in-up space-y-6">
          <h3 className="text-2xl font-display font-bold text-white tracking-wider">ANALYSIS RESULT</h3>
          
          <div className="text-center py-6 bg-cyber-bg/50 rounded-md border border-cyber-dim/20">
            <div className="flex flex-col items-center justify-center">
              {analysisResult.similarityScore > previousSimilarityScore && previousSimilarityScore > 0 && (
                <div className="text-cyber-accent animate-fade-in space-y-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 15l7-7 7 7" /></svg>
                  <p className="font-bold text-2xl font-display tracking-widest">STREAK +1</p>
                </div>
              )}
              {analysisResult.similarityScore < previousSimilarityScore && (
                <div className="text-red-500 animate-fade-in space-y-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" /></svg>
                  <p className="font-bold text-2xl font-display tracking-widest">STREAK -2</p>
                </div>
              )}
              {analysisResult.similarityScore === previousSimilarityScore && previousSimilarityScore > 0 && (
                <div className="text-cyber-dim animate-fade-in space-y-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 12h14" /></svg>
                  <p className="font-bold text-2xl font-display tracking-widest">STREAK UNCHANGED</p>
                </div>
              )}
               {previousSimilarityScore === 0 && (
                <div className="text-cyber-dim animate-fade-in">
                   <p className="font-bold text-2xl font-display tracking-widest">FIRST ATTEMPT</p>
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-4 mb-2">
              <h4 className="text-lg font-bold text-cyber-accent uppercase tracking-wider">Feedback Log</h4>
              {analysisResult.feedback.length > 0 && (
                <button
                  onClick={onStopSpeaking}
                  className="text-cyber-dim hover:text-cyber-primary transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isSpeaking ? "Stop speaking feedback" : "Feedback read automatically"}
                  disabled={!isSpeaking}
                >
                  {isSpeaking ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 animate-pulse-fast" viewBox="0 0 24 24" fill="currentColor"><path d="M8 8h8v8H8z" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" /></svg>
                  )}
                </button>
              )}
            </div>
            <ol className="list-decimal list-inside text-cyber-text space-y-2 font-sans">
              {analysisResult.feedback.map((item, index) => (
                <li 
                  key={index} 
                  className={`border-b border-cyber-dim/20 pb-1 transition-all duration-300 ${isSpeaking ? 'text-cyber-primary' : ''}`}
                >
                  {item}
                </li>
              ))}
            </ol>
          </div>

          {isPassed && (
            <div className="pt-4 text-center border-t border-cyber-primary/30">
              <p className="text-4xl font-display font-bold text-cyber-accent drop-shadow-[0_0_10px_#00ff7f]">
                CHALLENGE PASSED
              </p>
              <p className="text-cyber-text font-bold text-lg mb-4">Mission parameters met. Well done, agent.</p>

              {isNextChallengeAvailable ? (
                <button
                  onClick={onNextChallenge}
                  className="mt-2 py-2 px-6 bg-cyber-accent text-cyber-bg font-bold rounded-md transition-transform transform hover:scale-105 animate-glow"
                >
                  NEXT MISSION &rarr;
                </button>
              ) : (
                 <p className="mt-2 text-yellow-300 font-semibold">ALL MISSIONS COMPLETED. COMMAND AWAITS YOUR REPORT.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ChallengeView;