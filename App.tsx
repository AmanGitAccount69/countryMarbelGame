import React, { useState, useEffect, useCallback } from 'react';
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
    const loadVoices = () => window.speechSynthesis.getVoices();
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  const handleStartGame = () => {
    setHasStarted(true);
    if (window.speechSynthesis && soundEnabled) {
      window.speechSynthesis.resume();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
  };

  const handleRestartGame = () => {
    const reset = INITIAL_COUNTRIES.map(c => ({ ...c, wins: 0, isChampion: false }));
    setCountries(reset);
    setCanvasCountries(reset);
    setChampions([]);
    setActiveIds([]);
    setLastWinner(null);
    setIsGameOver(false);
    setRestartTrigger(t => t + 1);
  };

  // Text to Speech
  const announceWinner = (text: string) => {
    if (!window.speechSynthesis || !soundEnabled) return;

    window.speechSynthesis.cancel();
    setTimeout(() => {
      if (!soundEnabled) return;
      const u = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      u.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
      window.speechSynthesis.speak(u);
    }, 50);
  };

  const handleElimination = useCallback((ids: string[]) => {
    setActiveIds(ids);
  }, []);

  const handleRoundWin = useCallback(
    (winnerId: string) => {
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
          wonAt: Date.now(),
        });
        setChampions(updatedChampions);
      }

      setTimeout(() => {
        setLastWinner(null);
        if (updatedChampions.length >= GAME_CONFIG.MAX_CHAMPIONS_SHOWN) {
          setIsGameOver(true);
        } else {
          setCanvasCountries(updatedCountries);
          setRestartTrigger(t => t + 1);
        }
      }, 3000);
    },
    [countries, champions, isGameOver, soundEnabled]
  );

  const activeCountries = countries.filter(
    c => c.wins < GAME_CONFIG.WINS_TO_CHAMPION
  );

  return (
    <div className="relative min-h-screen w-full bg-slate-950 font-inter text-white select-none flex flex-col overflow-y-auto">

      {/* 1. Top UI Stack */}
      <div className="relative z-30 w-full flex flex-col shadow-2xl">
        <Scoreboard activeCountries={activeCountries} remainingIds={activeIds} />
        <ChampionsBoard champions={champions} />
      </div>

      {/* 2. Main Game Area */}
      <div className="relative w-full h-screen flex-shrink-0">
  <GameCanvas
    countries={canvasCountries}
    onRoundWin={handleRoundWin}
    onElimination={handleElimination}
    triggerRestart={restartTrigger}
    isPaused={!hasStarted || isGameOver}
    soundEnabled={soundEnabled}
  />
</div>


      {/* EXTRA 50% SCROLL SPACE */}
      <div className="h-[50vh] w-full pointer-events-none" />

      {/* Start Screen Overlay */}
      {!hasStarted && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-md">
          <h1 className="text-4xl md:text-6xl font-black mb-8 uppercase text-center">
            Marble World Cup
          </h1>
          <button
            onClick={handleStartGame}
            className="px-10 py-5 bg-yellow-500 text-slate-900 font-black text-2xl uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-xl"
          >
            Start Game
          </button>
          <p className="mt-6 text-slate-400 text-sm">
            Click to unlock audio & physics
          </p>
        </div>
      )}

      {/* Final Screen */}
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
          className={`px-4 py-2 rounded-full font-bold text-xs uppercase border ${
            soundEnabled
              ? 'bg-slate-800 text-green-400 border-green-500/50'
              : 'bg-slate-900 text-red-400 border-red-500/50'
          }`}
        >
          {soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
        </button>
      </div>

      {/* Round Winner Notification */}
      {lastWinner && !isGameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="bg-yellow-500 text-slate-900 px-12 py-6 rounded-3xl font-black text-4xl shadow-xl">
            {countries.find(c => c.id === lastWinner)?.name} Wins!
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
