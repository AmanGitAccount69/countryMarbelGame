import React from 'react';
import { Country, ChampionRecord } from '../types';

interface FinalScreenProps {
  countries: Country[];
  champions: ChampionRecord[];
  onRestart: () => void;
}

const FinalScreen: React.FC<FinalScreenProps> = ({ countries, champions, onRestart }) => {
  // Sort countries by wins (descending)
  const sortedCountries = [...countries].sort((a, b) => b.wins - a.wins);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center bg-slate-950/98 text-white overflow-hidden animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="w-full py-8 flex flex-col items-center bg-gradient-to-b from-slate-900 to-slate-950 border-b border-yellow-900/50 shadow-2xl shrink-0">
            <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-yellow-500 to-yellow-600 uppercase tracking-widest drop-shadow-sm mb-2">
                Tournament Complete
            </h1>
            <p className="text-slate-400 font-medium">All 4 Champions have been crowned</p>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 w-full max-w-5xl overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {sortedCountries.map((c, idx) => {
                    const isChampion = c.isChampion;
                    const championRank = champions.findIndex(ch => ch.countryId === c.id) + 1;

                    return (
                        <div 
                            key={c.id} 
                            className={`
                                relative flex items-center gap-4 p-4 rounded-xl border transition-all hover:scale-[1.02]
                                ${isChampion 
                                    ? 'bg-gradient-to-br from-yellow-900/30 to-slate-900 border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] order-first' 
                                    : 'bg-slate-900/50 border-slate-800'
                                }
                            `}
                        >
                            {/* Rank Badge */}
                            <div className={`
                                flex items-center justify-center w-8 h-8 rounded-full font-black text-sm border
                                ${isChampion 
                                    ? 'bg-yellow-500 text-slate-950 border-yellow-400' 
                                    : 'bg-slate-800 text-slate-500 border-slate-700'
                                }
                            `}>
                                {isChampion ? `C${championRank}` : idx + 1}
                            </div>

                            <img 
                                src={`https://flagcdn.com/w80/${c.code}.png`} 
                                alt={c.name}
                                className="w-10 h-7 rounded shadow-md object-cover" 
                            />
                            
                            <div className="flex flex-col min-w-0">
                                <span className={`font-bold truncate ${isChampion ? 'text-yellow-100' : 'text-slate-300'}`}>
                                    {c.name}
                                </span>
                                <span className={`text-xs font-mono ${isChampion ? 'text-yellow-500' : 'text-slate-500'}`}>
                                    {c.wins} Wins
                                </span>
                            </div>

                            {isChampion && (
                                <div className="absolute top-2 right-2 text-xl">👑</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Footer Actions */}
        <div className="w-full p-6 bg-slate-900/80 backdrop-blur border-t border-slate-800 shrink-0 flex justify-center">
            <button 
                onClick={onRestart}
                className="
                    px-12 py-4 rounded-full bg-yellow-500 text-slate-900 font-black text-xl uppercase tracking-widest 
                    shadow-[0_0_30px_rgba(234,179,8,0.4)] hover:scale-105 active:scale-95 hover:bg-yellow-400 transition-all
                "
            >
                Start New Tournament
            </button>
        </div>

    </div>
  );
};

export default FinalScreen;