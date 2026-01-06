import React from 'react';
import { Country } from '../types';

interface ScoreboardProps {
  activeCountries: Country[]; // Countries with < 4 wins
  remainingIds: string[]; 
}

const Scoreboard: React.FC<ScoreboardProps> = ({ activeCountries, remainingIds }) => {
  // Sort by Wins DESC, then by Name ASC
  const sortedCountries = [...activeCountries].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="w-full bg-slate-900/90 border-b border-slate-700 backdrop-blur-md z-30 flex flex-col pointer-events-auto h-20 shrink-0">
      {/* Header Label */}
      <div className="px-4 py-1 flex items-center justify-between border-b border-slate-800">
        <h2 className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-amber-600 uppercase tracking-widest">
          Live Wins Ranking
        </h2>
        <span className="text-[10px] text-green-400 font-bold">{remainingIds.length} Alive</span>
      </div>

      {/* Horizontal List */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-2 px-2 scrollbar-none">
        {sortedCountries.map((country) => {
          const isAlive = remainingIds.includes(country.id);
          
          return (
            <div 
              key={country.id}
              className={`flex-shrink-0 flex items-center gap-2 px-2 py-1 rounded border transition-all duration-300 ${
                isAlive 
                  ? 'bg-slate-800/80 border-slate-600 opacity-100' 
                  : 'bg-slate-900/50 border-transparent opacity-50 grayscale-[0.8]'
              }`}
            >
              <div className="relative">
                <img 
                  src={`https://flagcdn.com/w40/${country.code}.png`} 
                  alt={country.name}
                  className="w-6 h-4 rounded object-cover"
                />
                {!isAlive && (
                  <div className="absolute inset-0 bg-black/60 rounded flex items-center justify-center">
                    <span className="text-[8px] text-white font-bold">OUT</span>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col leading-none">
                <span className={`text-[10px] font-bold truncate max-w-[80px] ${isAlive ? 'text-white' : 'text-slate-500'}`}>
                  {country.name}
                </span>
                <span className={`text-[10px] font-mono font-bold ${country.wins > 0 ? 'text-yellow-400' : 'text-slate-600'}`}>
                  {country.wins} wins
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Scoreboard;