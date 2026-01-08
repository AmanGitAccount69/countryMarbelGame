import React, { useState, useEffect, useCallback, useRef } from 'react';
import GameCanvas from './components/GameCanvas';
import Scoreboard from './components/Scoreboard';
import ChampionsBoard from './components/ChampionsBoard';
import FinalScreen from './components/FinalScreen';
import { INITIAL_COUNTRIES, GAME_CONFIG } from './constants';
import { Country, ChampionRecord } from './types';

const App: React.FC = () => {
  // Master state for UI
  const [countries, setCountries] = useState<Country[]>(() => 
    INITIAL_COUNTRIES.map(c => ({ ...c, wins: 0, isChampion: false }))
  );
  
  // Snapshot state passed to GameCanvas (Physics Engine)
  const [canvasCountries, setCanvasCountries] = useState<Country[]>(() => 
    INITIAL_COUNTRIES.map(c => ({ ...c, wins: 0, isChampion: false }))
  );
  
  const [champions, setChampions] = useState<ChampionRecord[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [restartTrigger, setRestartTrigger] = useState(0);
  const [lastWinner, setLastWinner] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  
  // Game Start & Sound State
  const [hasStarted, setHasStarted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Load Voices on Mount
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis.getVoices();
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleStartGame = () => {
    setHasStarted(true);
    // Unlock Audio Context (TTS)
    if (window.speechSynthesis && soundEnabled) {
        window.speechSynthesis.resume();
        const u = new SpeechSynthesisUtterance("");
        window.speechSynthesis.speak(u);
    }
  };

  const handleRestartGame = () => {
    const resetCountries = INITIAL_COUNTRIES.map(c => ({ ...c, wins: 0, isChampion: false }));
    setCountries(resetCountries);
    setCanvasCountries(resetCountries);
    setChampions([]);
    setActiveIds([]);
    setLastWinner(null);
    setIsGameOver(false);
    setRestartTrigger(prev => prev + 1);
    // Scroll to top when restarting
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Text to Speech
  const announceWinner = (text: string) => {
    if (!window.speechSynthesis || !soundEnabled) return;
    
    window.speechSynthesis.cancel();
    
    // Slight delay to ensure audio context is ready
    setTimeout(() => {
        if (!soundEnabled) return; 
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') || voices[0];
        if (preferredVoice) utterance.voice = preferredVoice;
        
        window.speechSynthesis.speak(utterance);
    }, 50); 
  };

  const handleElimination = useCallback((ids: string[]) => {
    setActiveIds(ids);
  }, []);

  const handleRoundWin = useCallback((winnerId: string) => {
    if (isGameOver) return;

    const winner = countries.find(c => c.id === winnerId);
    if (!winner) return;

    setLastWinner(winnerId);
    announceWinner(`${winner.name} wins!`);

    const nextWins = winner.wins + 1;
    const isNowChampion = nextWins >= GAME_CONFIG.WINS_TO_CHAMPION;
    const isNewChampion = isNowChampion && !winner.isChampion;

    const updatedCountries = countries.map(c => 
      c.id === winnerId 
        ? { ...c, wins: nextWins, isChampion: c.isChampion || isNowChampion }
        : c
    );
    setCountries(updatedCountries);

    let updatedChampions = [...champions];
    if (isNewChampion) {
        updatedChampions.push({
            countryId: winner.id,
            name: winner.name,
            code: winner.code,
            wonAt: Date.now()
        });
        setChampions(updatedChampions);
    }

    setTimeout(() => {
        setLastWinner(null);

        if (updatedChampions.length >= GAME_CONFIG.MAX_CHAMPIONS_SHOWN) {
            setIsGameOver(true);
            // Optional: Scroll to top to see final screen better
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            setCanvasCountries(updatedCountries);
            setRestartTrigger(t => t + 1);
        }
    }, 3000);

  }, [countries, champions, isGameOver, soundEnabled]); 

  // Filter for the live scoreboard
  const activeCountries = countries.filter(c => c.wins < GAME_CONFIG.WINS_TO_CHAMPION);

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-inter text-white select-none flex flex-col">
      
      {/* 1. Main Game Viewport Wrapper */}
      <div className="relative h-[92vh] min-h-[600px] flex flex-col shrink-0 overflow-hidden shadow-2xl bg-slate-900">
        
        {/* Top UI Stack (Internal to Game Section) */}
        <div className="relative z-30 w-full flex flex-col shadow-lg">
          <Scoreboard 
              activeCountries={activeCountries} 
              remainingIds={activeIds} 
          />
          <ChampionsBoard 
              champions={champions}
          />
        </div>

        {/* Game Area */}
        <div className="relative flex-1 overflow-hidden">
          <GameCanvas 
            countries={canvasCountries}
            onRoundWin={handleRoundWin}
            onElimination={handleElimination}
            triggerRestart={restartTrigger}
            isPaused={!hasStarted || isGameOver}
            soundEnabled={soundEnabled}
          />

          {/* Start Screen Overlay */}
          {!hasStarted && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
                <h1 className="text-4xl md:text-6xl font-black text-white mb-8 drop-shadow-xl tracking-tighter uppercase text-center px-4">
                    Marble World Cup
                </h1>
                <button 
                    onClick={handleStartGame}
                    className="group relative px-10 py-5 bg-yellow-500 text-slate-900 font-black text-2xl uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(234,179,8,0.6)] z-50"
                >
                    Start Tournament
                    <div className="absolute inset-0 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
                </button>
                <p className="mt-6 text-slate-400 text-sm font-medium">Sound & Physics will initialize on click</p>
                <div className="mt-12 animate-bounce flex flex-col items-center text-slate-500">
                  <span className="text-[10px] uppercase font-bold tracking-[0.3em] mb-2">Scroll for info</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="19 9l-7 7-7-7"></path></svg>
                </div>
            </div>
          )}

          {/* Final Scoreboard Screen */}
          {isGameOver && (
              <FinalScreen 
                countries={countries}
                champions={champions}
                onRestart={handleRestartGame}
              />
          )}

          {/* Sound Toggle (Absolute inside Game Section) */}
          <div className="absolute bottom-6 right-6 z-40">
            <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs uppercase tracking-wider shadow-lg transition-all border ${
                    soundEnabled 
                    ? 'bg-slate-800 text-green-400 border-green-500/50 hover:bg-slate-700' 
                    : 'bg-slate-900 text-red-400 border-red-500/50 hover:bg-slate-800'
                }`}
            >
                <span>{soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}</span>
            </button>
          </div>

          {/* Round Winner Notification */}
          {lastWinner && !isGameOver && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
                <div className="bg-yellow-500 text-slate-900 px-8 py-4 md:px-12 md:py-8 rounded-[2rem] font-black text-2xl md:text-5xl shadow-[0_0_50px_rgba(234,179,8,0.5)] border-4 border-white animate-arcade-pop text-center whitespace-nowrap">
                  {countries.find(c => c.id === lastWinner)?.name} Wins!
                </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Scrollable Content Section */}
      <div className="bg-slate-950 py-20 px-6 md:px-20 lg:px-40 space-y-24 border-t border-slate-800">
        
        {/* About Section */}
        <section className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-500">
            About the Game
          </h2>
          <p className="text-slate-400 text-lg leading-relaxed">
            Welcome to the Marble World Cup! This is a high-stakes, physics-driven simulation where countries compete for the ultimate title. Each round, marbles representing different nations are released into a spinning arena. The last marble to stay within the arena wins the round.
          </p>
        </section>


        
      </div>

    </div>
  );
};

export default App;