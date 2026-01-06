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
    // Safety check: Prevent updates if game is already over
    if (isGameOver) return;

    // 1. Identify Winner
    const winner = countries.find(c => c.id === winnerId);
    if (!winner) return;

    // 2. Visual Feedback immediately
    setLastWinner(winnerId);
    announceWinner(`${winner.name} wins!`);

    // 3. Calculate New State (Pure Logic)
    const nextWins = winner.wins + 1;
    // Check if they BECOME a champion this specific turn
    const isNowChampion = nextWins >= GAME_CONFIG.WINS_TO_CHAMPION;
    const isNewChampion = isNowChampion && !winner.isChampion;

    // 4. Update Main Countries State
    const updatedCountries = countries.map(c => 
      c.id === winnerId 
        ? { ...c, wins: nextWins, isChampion: c.isChampion || isNowChampion }
        : c
    );
    setCountries(updatedCountries);

    // 5. Update Champions List Locally & In State
    // We use a local variable to check the stop condition immediately
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

    // 6. Game Flow Decision (Delayed)
    // Wait 3 seconds for the "Wins!" banner to show, then proceed
    setTimeout(() => {
        setLastWinner(null);

        // STRICT STOP CONDITION: Check if we have enough champions
        if (updatedChampions.length >= GAME_CONFIG.MAX_CHAMPIONS_SHOWN) {
            setIsGameOver(true);
        } else {
            // Continue Loop: Update physics source data and restart round
            setCanvasCountries(updatedCountries);
            setRestartTrigger(t => t + 1);
        }
    }, 3000);

  }, [countries, champions, isGameOver, soundEnabled]); 

  // Filter for the live scoreboard
  const activeCountries = countries.filter(c => c.wins < GAME_CONFIG.WINS_TO_CHAMPION);

  return (
    <div className= "flex flex-col pb-10 bg-red-500 overflow-hidden">
<div className="relative h-screen w-full bg-slate-950 overflow-hidden font-inter text-white select-none flex flex-col">
      
      {/* 1. Top UI Stack */}
      <div className="relative z-30 w-full flex flex-col shadow-2xl">
        <Scoreboard 
            activeCountries={activeCountries} 
            remainingIds={activeIds} 
        />
        <ChampionsBoard 
            champions={champions}
        />
      </div>

      {/* 2. Main Game Area */}
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
                Start Game
                <div className="absolute inset-0 rounded-full border-2 border-white opacity-0 group-hover:opacity-100 group-hover:animate-ping" />
            </button>
            <p className="mt-6 text-slate-400 text-sm font-medium">Click to unlock audio & physics</p>
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

      {/* Sound Toggle */}
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
  );
};

export default App;