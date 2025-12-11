import React, { useState, useEffect } from 'react';
import GameEngine from './components/GameEngine';
import { GameState } from './types';
import { PALETTE } from './constants';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MAP);
  const [hp, setHp] = useState(100);
  const [cityScroll, setCityScroll] = useState(0);
  const [showDragonLore, setShowDragonLore] = useState(false);

  const handleCityStart = () => {
    setCityScroll(0); // Reset scroll to start (bottom)
    audioService.startAmbient();
  };

  const handleZigguratEnter = () => {
    setCityScroll(0); 
    setShowDragonLore(false);
  };

  const handleStatueClick = () => {
      setShowDragonLore(true);
  };

  // Effect to watch state changes
  useEffect(() => {
    if (gameState === GameState.ZIGGURAT_INSIDE) {
      handleZigguratEnter();
    } else {
        setShowDragonLore(false);
    }
  }, [gameState]);

  return (
    <div className="w-full h-screen bg-gray-900 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Retro TV Bezel/Container */}
      <div className="relative w-full max-w-4xl aspect-[4/3] bg-black border-8 border-gray-700 rounded-lg shadow-2xl p-2 flex">
        
        {/* Game Engine (Canvas) */}
        <div className="w-full h-full relative bg-[#000] flex-1">
           <GameEngine 
             gameState={gameState} 
             setGameState={setGameState}
             onExplore={handleCityStart}
             scrollPercent={cityScroll}
             onStatueClick={handleStatueClick}
           />
           
           {/* Scanline Effect Overlay (CSS) */}
           <div className="absolute inset-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))]" style={{backgroundSize: "100% 2px, 3px 100%"}}></div>

           {/* Dragon Lore Modal Overlay */}
           {showDragonLore && (
               <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50 p-8 animate-in fade-in duration-300" onClick={() => setShowDragonLore(false)}>
                   <div className="bg-[#2d2338] border-4 border-white p-6 max-w-lg shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
                       <div className="absolute -top-3 left-4 bg-[#2d2338] px-2 text-[#ffe600] font-bold border border-[#ffe600]">LEGEND OF ENLATHIEN</div>
                       
                       <p className="text-white font-mono text-lg leading-relaxed text-justify" style={{fontFamily: "'VT323', monospace"}}>
                         <span className="text-[#ffe600]">This dragon statue honors the founder of Enlathien.</span><br/><br/>
                         Long ago, a <span className="text-[#ff4d4d]">Dragon Father</span> from the sky and a <span className="text-[#5ce1fa]">Fairy Mother</span> from the winds fell in love and raised one hundred children. 
                         When a great monster rose from beneath the earth, the Dragon Father and fifty of his children sacrificed themselves to seal it deep underground.<br/><br/>
                         The great temple was later built above the seal to protect the land. The eldest child became the first ruler of Enlathien, guiding the people with courage and wisdom. 
                         Today, the dragon remains a symbol of protection, family, and the spirit of our city.
                       </p>

                       <div className="mt-6 text-center">
                           <button 
                             onClick={() => setShowDragonLore(false)}
                             className="px-6 py-2 bg-[#ff4d4d] text-white border-2 border-white hover:bg-red-600 font-mono text-xl"
                             style={{fontFamily: "'VT323', monospace"}}
                           >
                             CLOSE
                           </button>
                       </div>
                   </div>
               </div>
           )}
        </div>

        {/* Vertical Controls Overlay (Visible in City Mode) */}
        {gameState === GameState.CITY_EXPLORATION && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2 h-3/4 w-8 flex flex-col items-center justify-center z-10">
               <div className="h-full relative w-4 bg-gray-800 border-2 border-gray-600 rounded-full overflow-visible group">
                  {/* Styled Range Input - Rotated */}
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={cityScroll}
                    onChange={(e) => setCityScroll(Number(e.target.value))}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-8 opacity-0 cursor-pointer z-20"
                    style={{ transform: 'translate(-50%, -50%) rotate(-90deg)' }}
                  />
                  
                  {/* Visual Track Indicator */}
                  <div 
                    className="absolute bottom-0 left-0 right-0 bg-yellow-600 rounded-b-full transition-all duration-75"
                    style={{ height: `${cityScroll}%` }}
                  ></div>

                  {/* Visual Thumb */}
                  <div 
                    className="absolute left-1/2 -translate-x-1/2 w-6 h-6 bg-yellow-400 border-2 border-white rounded-sm shadow-[0_4px_0_#b45309] z-10 pointer-events-none transition-all duration-75"
                     style={{ bottom: `calc(${cityScroll}% - 12px)` }}
                  ></div>
               </div>
               
               {/* Label */}
               <div className="mt-2 text-white font-mono text-xs bg-black px-1 border border-gray-500">
                  SCROLL
               </div>
            </div>
        )}

        {/* UI Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none z-50">
           <div className="flex gap-4">
              <div className="px-3 py-1 border-2 border-white bg-blue-800 text-white font-mono text-sm shadow-md" style={{fontFamily: "'VT323', monospace", imageRendering: 'pixelated'}}>
                 HP <span className="text-red-300">❤❤❤❤❤</span> {hp}/100
              </div>
           </div>
           
           {/* EXIT BUTTON - Visible only inside Ziggurat */}
           {gameState === GameState.ZIGGURAT_INSIDE && !showDragonLore && (
               <button 
                 onClick={() => {
                     audioService.playSelectSound();
                     setCityScroll(95); // Set to near end so Ziggurat is visible
                     setGameState(GameState.CITY_EXPLORATION);
                 }}
                 className="pointer-events-auto px-4 py-1 border-2 border-white bg-red-800 hover:bg-red-700 text-white font-mono text-xl shadow-lg transition-colors flex items-center gap-2"
                 style={{fontFamily: "'VT323', monospace"}}
               >
                 <span>EXIT</span>
                 <span className="text-xs">▼</span>
               </button>
           )}
        </div>

        {/* Scene Specific UI hints */}
        {gameState === GameState.MAP && (
             <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none animate-pulse">
                <span className="bg-black/70 text-white px-4 py-2 font-mono text-xl border border-white">CLICK ENLATHIEN TO ENTER</span>
             </div>
        )}
        
        {/* Ziggurat Hint */}
        {gameState === GameState.CITY_EXPLORATION && cityScroll > 80 && (
            <div className="absolute bottom-10 left-0 right-0 text-center pointer-events-none animate-pulse">
                <span className="bg-black/70 text-yellow-300 px-4 py-2 font-mono text-lg border border-yellow-500">CLICK THE TEMPLE</span>
            </div>
        )}

      </div>

      <div className="mt-4 text-gray-500 font-mono text-xs text-center">
        Controls: Mouse/Touch Only | Use Vertical Slider to Explore
      </div>
      
      {/* Global CSS for Animations */}
      <style>{`
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .blink-anim {
          animation: blink 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default App;