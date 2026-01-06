import React from 'react';
import { ChampionRecord } from '../types';

interface ChampionsBoardProps {
  champions: ChampionRecord[];
}

const ChampionsBoard: React.FC<ChampionsBoardProps> = ({ champions }) => {
  // Create an array of 4 slots to ensure the layout always shows the goal
  const slots = [0, 1, 2, 3];

  return (
    <div className="w-full bg-slate-900/95 border-b border-yellow-500/30 backdrop-blur-md z-20 flex flex-col pointer-events-auto shrink-0 shadow-lg relative">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/10 via-transparent to-transparent pointer-events-none" />

      {/* Header */}
      <div className="relative px-4 py-1.5 flex items-center justify-between border-b border-yellow-500/10">
         <div className="flex items-center gap-3">
            <span className="text-[10px] md:text-xs font-black text-yellow-400 uppercase tracking-[0.2em] drop-shadow-sm flex items-center gap-2">
                <span className="text-lg leading-none">👑</span> Top 4 Champions
            </span>
            <span className="bg-yellow-500/10 text-yellow-200 text-[9px] px-2 py-0.5 rounded-full border border-yellow-500/20 font-mono">
                {champions.length} / 4 Found
            </span>
         </div>
      </div>

      {/* Slots Container - Fixed 4 slots */}
      <div className="relative flex items-center gap-2 p-2 overflow-x-auto scrollbar-none min-h-[60px]">
        {slots.map((slotIndex) => {
            const champ = champions[slotIndex];
            const isFilled = !!champ;

            return (
                <div 
                    key={slotIndex}
                    className={`
                        relative flex-1 min-w-[120px] h-12 rounded border flex items-center px-3 gap-3 transition-all duration-500
                        ${isFilled 
                            ? 'bg-gradient-to-br from-yellow-900/40 to-slate-900 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)] animate-in zoom-in-95 fade-in' 
                            : 'bg-slate-900/30 border-slate-800 border-dashed opacity-60'
                        }
                    `}
                >
                    {/* Rank Number */}
                    <div className={`
                        flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold border
                        ${isFilled 
                            ? 'bg-yellow-500 text-slate-900 border-yellow-300 shadow-sm' 
                            : 'bg-slate-800 text-slate-600 border-slate-700'
                        }
                    `}>
                        {slotIndex + 1}
                    </div>

                    {isFilled ? (
                        <>
                            <img 
                                src={`https://flagcdn.com/w40/${champ.code}.png`} 
                                alt={champ.name}
                                className="w-6 h-4 rounded shadow-sm object-cover"
                            />
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-[11px] font-black text-yellow-100 truncate uppercase tracking-tight">
                                    {champ.name}
                                </span>
                                <span className="text-[8px] text-yellow-500/80 font-mono leading-none mt-0.5">
                                    Champion
                                </span>
                            </div>
                            
                            {/* Shiny effect overlay */}
                            <div className="absolute inset-0 rounded bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 animate-pulse pointer-events-none" />
                        </>
                    ) : (
                        <div className="flex flex-col justify-center h-full">
                            <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wide">
                                Empty Slot
                            </span>
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default ChampionsBoard;