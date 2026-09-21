import React, { useState, useEffect, useRef } from 'react';
import { Package, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface CasesGameProps {
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface CaseItem {
  id: string;
  name: string;
  type: 'tokens' | 'boost' | 'skin';
  amount?: number;
  skinId?: string;
  skinType?: 'coin' | 'plane';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  weight: number;
}

interface CaseTier {
  id: string;
  name: string;
  cost: number;
  description: string;
  badge: string;
  color: string;
  items: CaseItem[];
}

const RARITY_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  common: { border: 'border-slate-500/40', bg: 'bg-slate-900/80', text: 'text-slate-300', glow: 'shadow-slate-500/20' },
  uncommon: { border: 'border-cyan-500/50', bg: 'bg-cyan-950/40', text: 'text-cyan-300', glow: 'shadow-cyan-500/30' },
  rare: { border: 'border-blue-500/60', bg: 'bg-blue-950/50', text: 'text-blue-300', glow: 'shadow-blue-500/40' },
  epic: { border: 'border-purple-500/70', bg: 'bg-purple-950/60', text: 'text-purple-300', glow: 'shadow-purple-500/50' },
  legendary: { border: 'border-amber-400', bg: 'bg-amber-950/70', text: 'text-amber-300', glow: 'shadow-amber-400/60' },
};

export const CasesGame: React.FC<CasesGameProps> = ({ balance, onBalanceUpdate }) => {
  const [cases, setCases] = useState<CaseTier[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('starter');
  const [isOpening, setIsOpening] = useState(false);
  const [rouletteItems, setRouletteItems] = useState<CaseItem[]>([]);
  const [winningItem, setWinningItem] = useState<CaseItem | null>(null);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const { hapticImpact, hapticNotification } = useTelegram();

  // Load cases catalog
  useEffect(() => {
    apiRequest<{ success: boolean; cases: CaseTier[] }>('/api/games/cases/catalog')
      .then((res) => {
        if (res.success && res.cases) {
          setCases(res.cases);
          if (res.cases.length > 0) {
            setSelectedCaseId(res.cases[0].id);
          }
        }
      })
      .catch((err) => {
        setError(err.message || 'Ошибка загрузки кейсов');
      });
  }, []);

  const activeCase = cases.find((c) => c.id === selectedCaseId) || cases[0];

  // Open the selected case
  const handleOpenCase = async () => {
    if (!activeCase || isOpening || balance < activeCase.cost) return;

    try {
      setIsOpening(true);
      setError(null);
      setShowWinnerModal(false);
      setWinningItem(null);
      setTranslateX(0);
      hapticImpact('heavy');

      // Optimistically update balance
      onBalanceUpdate(balance - activeCase.cost);

      const res = await apiRequest<{
        success: boolean;
        winningItem: CaseItem;
        rouletteItems: CaseItem[];
        winnerIndex: number;
        balance: number;
      }>('/api/games/cases/open', {
        method: 'POST',
        body: JSON.stringify({ caseId: activeCase.id }),
      });

      if (!res.success) {
        throw new Error('Не удалось открыть кейс');
      }

      setRouletteItems(res.rouletteItems);
      setWinningItem(res.winningItem);

      // Start scrolling animation after items mount
      setTimeout(() => {
        const itemWidth = 116; // 108px + 8px gap
        const containerWidth = containerRef.current ? containerRef.current.clientWidth : 340;
        const centerOffset = containerWidth / 2 - 54;
        const jitter = (Math.random() - 0.5) * 40; // slight random landing inside target card
        const targetX = -(res.winnerIndex * itemWidth - centerOffset + jitter);

        setTranslateX(targetX);
        soundManager.playClick();

        // Reveal winner after spin completes (4.5s)
        setTimeout(() => {
          setIsOpening(false);
          setShowWinnerModal(true);
          onBalanceUpdate(res.balance);
          hapticNotification('success');
          soundManager.playVictoryFanfare();

          confetti({
            particleCount: 75,
            spread: 75,
            origin: { y: 0.55 },
            colors: ['#f59e0b', '#38bdf8', '#a855f7', '#10b981'],
          });
        }, 4600);
      }, 50);
    } catch (err: any) {
      setIsOpening(false);
      hapticNotification('error');
      setError(err.message || 'Ошибка при открытии');
    }
  };

  return (
    <div className="space-y-4 select-none">
      {/* Case Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {cases.map((c) => {
          const isSelected = c.id === selectedCaseId;
          return (
            <button
              key={c.id}
              disabled={isOpening}
              onClick={() => {
                setSelectedCaseId(c.id);
                setRouletteItems([]);
                setTranslateX(0);
              }}
              className={`flex-1 min-w-[100px] p-3 rounded-2xl border transition-all text-left cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 border-sky-400/80 shadow-lg shadow-sky-500/10 scale-[1.02]'
                  : 'bg-slate-950/60 border-white/5 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/10 text-white">
                  {c.badge}
                </span>
                <span className="text-xs">📦</span>
              </div>
              <div className="text-xs font-bold text-white mt-1.5 truncate">{c.name}</div>
              <div className="text-xs font-mono font-black text-amber-300 mt-0.5">
                {formatTokens(c.cost)} Т
              </div>
            </button>
          );
        })}
      </div>

      {activeCase && (
        <div className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3.5 backdrop-blur-md relative overflow-hidden">
          {/* Header Info */}
          <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Package className="w-4 h-4 text-sky-400" />
                {activeCase.name}
              </h3>
              <p className="text-[11px] text-slate-400">{activeCase.description}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500">Цена</span>
              <div className="text-sm font-mono font-black text-amber-400">
                {formatTokens(activeCase.cost)} Т
              </div>
            </div>
          </div>

          {/* Horizontal Roulette Spinning Ribbon */}
          <div
            ref={containerRef}
            className="relative w-full h-32 rounded-xl bg-black/60 border border-white/10 overflow-hidden flex items-center"
          >
            {/* Center Pointer Marker */}
            <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-1 bg-amber-400 z-30 pointer-events-none shadow-[0_0_12px_rgba(251,191,36,0.9)]">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-amber-400" />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-amber-400" />
            </div>

            {/* Scrolling Tape Container */}
            {rouletteItems.length > 0 ? (
              <div
                className="flex gap-2 px-4 transition-transform duration-[4500ms] ease-[cubic-bezier(0.12,0.8,0.25,1)]"
                style={{ transform: `translateX(${translateX}px)` }}
              >
                {rouletteItems.map((item, idx) => {
                  const rStyle = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;

                  return (
                    <div
                      key={idx}
                      className={`w-[108px] h-24 shrink-0 rounded-xl border flex flex-col items-center justify-center p-2 text-center shadow-md ${rStyle.border} ${rStyle.bg}`}
                    >
                      <div className="text-2xl mb-1">{item.icon}</div>
                      <div className="text-[10px] font-bold text-white truncate w-full">{item.name}</div>
                      <div className={`text-[9px] uppercase font-mono font-bold mt-0.5 ${rStyle.text}`}>
                        {item.rarity}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Idle Showcase Preview */
              <div className="w-full flex items-center justify-center text-center p-4">
                <div className="space-y-1 text-slate-400">
                  <div className="text-3xl animate-bounce">🎁</div>
                  <div className="text-xs font-bold text-white">Нажмите «Открыть кейс»</div>
                  <div className="text-[10px] text-slate-500">Шанс на x10 джекпот, буст фермы или скин</div>
                </div>
              </div>
            )}
          </div>

          {/* Possible Drops Showcase */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>Содержимое кейса:</span>
              <span className="text-emerald-400 font-mono text-[10px]">Дроп до x10</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {activeCase.items.map((item) => {
                const rStyle = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-xl border flex items-center gap-2 ${rStyle.border} ${rStyle.bg}`}
                  >
                    <span className="text-base">{item.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-bold text-white truncate">{item.name}</div>
                      <div className={`text-[9px] uppercase font-mono ${rStyle.text}`}>{item.rarity}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Open Button */}
          <button
            onClick={handleOpenCase}
            disabled={isOpening || balance < activeCase.cost}
            className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-4 h-4 ${isOpening ? 'animate-spin' : ''}`} />
            <span>
              {isOpening
                ? 'КЕЙС ОТКРЫВАЕТСЯ...'
                : `ОТКРЫТЬ КЕЙС (${formatTokens(activeCase.cost)} Т)`}
            </span>
          </button>
        </div>
      )}

      {/* Winner Reveal Modal */}
      {showWinnerModal && winningItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full max-w-sm bg-slate-900 border border-white/20 rounded-3xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

            <div className="text-6xl drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] animate-bounce">
              {winningItem.icon}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                ВАШ ВЫИГРЫШ!
              </span>
              <h3 className="text-xl font-black text-white mt-1">{winningItem.name}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {winningItem.type === 'tokens' && 'Токены сразу зачислены на ваш игровой баланс!'}
                {winningItem.type === 'boost' && 'Буст майнинга активирован и пополнил хранилище!'}
                {winningItem.type === 'skin' && 'Новый скин разблокирован и одет в профиле!'}
              </p>
            </div>

            <button
              onClick={() => setShowWinnerModal(false)}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition cursor-pointer"
            >
              ОТЛИЧНО, ЗАБРАТЬ!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
