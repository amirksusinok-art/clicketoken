import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, Gift, Wand2, RefreshCw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface ScratchGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface ScratchTier {
  id: string;
  name: string;
  cost: number;
  maxPrize: number;
  color: string;
  description: string;
}

type ScratchSymbolType =
  | 'gpu'
  | 'energy'
  | 'platinum'
  | 'token'
  | 'diamond'
  | 'quantum'
  | 'ticket';

const SYMBOL_DATA: Record<ScratchSymbolType, { label: string; icon: string; mult: string }> = {
  gpu: { label: 'GPU 1060', icon: '⚡', mult: '×1' },
  energy: { label: 'Энергия', icon: '🔥', mult: '×1.5' },
  platinum: { label: 'Слиток', icon: '🥈', mult: '×2.5' },
  token: { label: 'Токен', icon: '🪙', mult: '×3' },
  diamond: { label: 'Алмаз', icon: '💎', mult: '×4' },
  quantum: { label: 'Квантум', icon: '🪐', mult: '×10' },
  ticket: { label: 'Фри-тикет', icon: '🎟️', mult: 'FREE' },
};

interface CardData {
  ticketId: string;
  tier: ScratchTier;
  grid: ScratchSymbolType[];
  bonusBox: {
    type: string;
    label: string;
    multiplier: number;
    extraTokens: number;
  };
  matchedSymbol: ScratchSymbolType | null;
  basePayout: number;
  finalPayout: number;
  multiplier: number;
  isWin: boolean;
  balance: number;
}

export const ScratchGame: React.FC<ScratchGameProps> = ({ balance, onBalanceUpdate }) => {
  const [tiers, setTiers] = useState<ScratchTier[]>([]);
  const [selectedTierId, setSelectedTierId] = useState<string>('bronze');
  const [cardData, setCardData] = useState<CardData | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [bonusRevealed, setBonusRevealed] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isScratching = useRef(false);
  const lastSoundTime = useRef(0);

  const { hapticImpact, hapticNotification } = useTelegram();

  // Load catalog
  useEffect(() => {
    apiRequest<{ success: boolean; tiers: ScratchTier[] }>('/api/games/scratch/catalog')
      .then((res) => {
        if (res.success && res.tiers) {
          setTiers(res.tiers);
          if (res.tiers.length > 0) setSelectedTierId(res.tiers[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Draw scratch foil onto canvas
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Reset composite
    ctx.globalCompositeOperation = 'source-over';

    // Silver/Gold metallic gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (selectedTierId === 'gold') {
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(0.3, '#fef08a');
      grad.addColorStop(0.7, '#d97706');
      grad.addColorStop(1, '#b45309');
    } else if (selectedTierId === 'quantum') {
      grad.addColorStop(0, '#9333ea');
      grad.addColorStop(0.4, '#c084fc');
      grad.addColorStop(0.7, '#7e22ce');
      grad.addColorStop(1, '#581c87');
    } else {
      grad.addColorStop(0, '#64748b');
      grad.addColorStop(0.3, '#cbd5e1');
      grad.addColorStop(0.7, '#94a3b8');
      grad.addColorStop(1, '#475569');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Decorative hatch pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 2;
    for (let i = -height; i < width + height; i += 18) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }

    // Centered foil seal stamp
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨ СОТРИТЕ ЗАЩИТНЫЙ СЛОЙ ✨', width / 2, height / 2);
  }, [selectedTierId]);

  // Buy new ticket
  const handleBuyTicket = async () => {
    const activeTier = tiers.find((t) => t.id === selectedTierId);
    if (!activeTier || balance < activeTier.cost || isBuying) return;

    try {
      setIsBuying(true);
      setError(null);
      setIsRevealed(false);
      setBonusRevealed(false);
      hapticImpact('heavy');
      soundManager.playClick();

      // Optimistic balance
      onBalanceUpdate(balance - activeTier.cost);

      const res = await apiRequest<{
        success: boolean;
      } & CardData>('/api/games/scratch/buy', {
        method: 'POST',
        body: JSON.stringify({ tierId: selectedTierId }),
      });

      if (!res.success) throw new Error('Ошибка покупки билета');

      setCardData(res);
      onBalanceUpdate(res.balance);

      // Re-init canvas foil after DOM renders
      setTimeout(() => {
        initCanvas();
      }, 50);
    } catch (err: any) {
      setError(err.message || 'Ошибка запуска игры');
      hapticNotification('error');
    } finally {
      setIsBuying(false);
    }
  };

  // Scratch action
  const scratchAt = (clientX: number, clientY: number) => {
    if (isRevealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, 24, 0, Math.PI * 2);
    ctx.fill();

    // Sound and haptic throttling
    const now = Date.now();
    if (now - lastSoundTime.current > 75) {
      soundManager.playScratch();
      hapticImpact('light');
      lastSoundTime.current = now;
    }

    // Emit sparks particles
    if (Math.random() < 0.6) {
      const pId = Date.now() + Math.random();
      const sparkColor = selectedTierId === 'gold' ? '#fde047' : '#93c5fd';
      setParticles((prev) => [...prev.slice(-15), { id: pId, x: clientX - rect.left, y: clientY - rect.top, color: sparkColor }]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => p.id !== pId));
      }, 500);
    }

    // Check clear percentage periodically
    if (Math.random() < 0.2) {
      checkClearedPercent();
    }
  };

  const checkClearedPercent = () => {
    const canvas = canvasRef.current;
    if (!canvas || isRevealed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Sample pixels on a coarse grid
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    let transparent = 0;
    const totalSamples = data.length / 16; // sample every 4th pixel

    for (let i = 3; i < data.length; i += 16) {
      if (data[i] < 128) transparent++;
    }

    const percent = transparent / totalSamples;
    if (percent > 0.55) {
      revealAll();
    }
  };

  // Reveal all (Instant clear)
  const revealAll = () => {
    if (isRevealed) return;
    setIsRevealed(true);
    setBonusRevealed(true);
    hapticImpact('medium');

    if (cardData?.isWin) {
      hapticNotification('success');
      soundManager.playVictoryFanfare();
      confetti({
        particleCount: 70,
        spread: 75,
        origin: { y: 0.6 },
      });
    } else {
      soundManager.playWhoosh();
    }
  };

  const activeTier = tiers.find((t) => t.id === selectedTierId) || tiers[0];

  return (
    <div className="space-y-3.5 select-none">
      {/* Tier Selector Ribbon */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-900/80 border border-white/10 rounded-2xl">
        {tiers.map((t) => {
          const isSelected = t.id === selectedTierId;
          return (
            <button
              key={t.id}
              onClick={() => {
                if (!isBuying) {
                  setSelectedTierId(t.id);
                  setCardData(null);
                  setIsRevealed(false);
                  hapticImpact('light');
                }
              }}
              className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-b from-amber-500/30 to-amber-600/10 border-amber-400 text-amber-300 ring-1 ring-amber-400 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-[10px] font-black uppercase truncate">{t.name}</div>
              <div className="text-xs font-mono font-bold mt-0.5 text-emerald-400">{t.cost} Т</div>
            </button>
          );
        })}
      </div>

      {/* Ticket Card Arena */}
      <div className="relative w-full rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-[#0e1628] via-[#121e38] to-[#0a1020] p-4 shadow-2xl">
        {/* Ticket Header & Jackpot Tag */}
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎟️</span>
            <div>
              <div className="font-black text-white uppercase text-[11px] tracking-wider">
                {activeTier?.name || 'Скретч-билет'}
              </div>
              <div className="text-[9px] text-slate-400">Найдите 3 одинаковых символа</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400 uppercase font-bold">ДЖЕКПОТ</div>
            <div className="text-xs font-mono font-black text-amber-400">
              до {activeTier?.maxPrize || 50} Т
            </div>
          </div>
        </div>

        {cardData ? (
          /* Active Scratch Surface */
          <div className="space-y-3">
            {/* 3x3 Symbol Grid with Canvas Mask */}
            <div className="relative w-full aspect-square max-w-[290px] mx-auto rounded-2xl overflow-hidden bg-black/50 border border-white/10 p-2 shadow-inner">
              {/* Underlying Symbols Grid */}
              <div className="w-full h-full grid grid-cols-3 gap-2">
                {cardData.grid.map((sym, idx) => {
                  const data = SYMBOL_DATA[sym];
                  const isWinningCell = cardData.isWin && cardData.matchedSymbol === sym;

                  return (
                    <div
                      key={idx}
                      className={`rounded-xl flex flex-col items-center justify-center p-1 border transition-all ${
                        isWinningCell && isRevealed
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105 animate-pulse'
                          : 'bg-slate-900/90 border-white/5 text-white'
                      }`}
                    >
                      <span className="text-2xl drop-shadow-md">{data.icon}</span>
                      <span className="text-[9px] font-mono font-black mt-1 text-amber-300">{data.mult}</span>
                      <span className="text-[8px] text-slate-400 truncate max-w-full font-bold">{data.label}</span>
                    </div>
                  );
                })}
              </div>

              {/* Scratch Foil Canvas Overlay */}
              {!isRevealed && (
                <canvas
                  ref={canvasRef}
                  width={290}
                  height={290}
                  onMouseDown={() => (isScratching.current = true)}
                  onMouseUp={() => (isScratching.current = false)}
                  onMouseLeave={() => (isScratching.current = false)}
                  onMouseMove={(e) => {
                    if (isScratching.current) scratchAt(e.clientX, e.clientY);
                  }}
                  onTouchStart={() => (isScratching.current = true)}
                  onTouchEnd={() => (isScratching.current = false)}
                  onTouchMove={(e) => {
                    if (e.touches[0]) scratchAt(e.touches[0].clientX, e.touches[0].clientY);
                  }}
                  className="absolute inset-0 w-full h-full cursor-crosshair touch-none rounded-2xl z-10 transition-opacity duration-500"
                />
              )}

              {/* Flying Sparkle Particles */}
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="absolute w-2 h-2 rounded-full pointer-events-none animate-ping"
                  style={{
                    left: p.x,
                    top: p.y,
                    backgroundColor: p.color,
                  }}
                />
              ))}
            </div>

            {/* Lucky Box (Bonus Cell) */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-900/80 border border-amber-400/20">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-300">Бонусная ячейка:</span>
              </div>
              <button
                onClick={() => {
                  setBonusRevealed(true);
                  hapticImpact('light');
                  soundManager.playPop();
                }}
                className="px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 font-mono font-black text-xs cursor-pointer hover:bg-amber-500/30"
              >
                {bonusRevealed ? cardData.bonusBox.label : '❓ Стереть бонус'}
              </button>
            </div>

            {/* Result Status Banner */}
            {isRevealed && (
              <div
                className={`py-2 px-3 rounded-xl text-center border font-bold text-xs animate-bounce ${
                  cardData.isWin
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'bg-rose-500/20 border-rose-400 text-rose-300'
                }`}
              >
                {cardData.isWin
                  ? `ВЫИГРЫШ: +${formatTokens(cardData.finalPayout)} Т (МНОЖИТЕЛЬ ×${cardData.multiplier})`
                  : 'В ЭТОМ БИЛЕТЕ НЕТ 3 СОВПАДЕНИЙ'}
              </div>
            )}

            {/* Quick Actions Buttons */}
            <div className="flex items-center gap-2 pt-1">
              {!isRevealed ? (
                <button
                  onClick={revealAll}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Стереть всё (Быстро)</span>
                </button>
              ) : (
                <button
                  onClick={handleBuyTicket}
                  disabled={balance < activeTier.cost}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Ещё билет ({activeTier.cost} Т)</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Empty State: Prompt to purchase ticket */
          <div className="text-center py-8 space-y-3">
            <div className="text-4xl animate-pulse">🎫</div>
            <div className="text-sm font-black text-white">Готовы испытать удачу?</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              Купите билет за {activeTier?.cost || 1} Т, сотрите защитный слой пальцем и заберите до {activeTier?.maxPrize || 50} Т!
            </p>
            <button
              onClick={handleBuyTicket}
              disabled={isBuying || balance < activeTier.cost}
              className="mt-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/30 active:scale-95 transition cursor-pointer"
            >
              <Sparkles className="w-4 h-4 inline mr-1.5" />
              {isBuying ? 'Покупка...' : `КУПИТЬ БИЛЕТ (${activeTier.cost} Т)`}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs text-center">
          {error}
        </div>
      )}
    </div>
  );
};
