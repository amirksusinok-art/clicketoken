import React, { useState, useEffect } from 'react';
import { X, Cpu, Clock, Zap, ArrowUpRight, CheckCircle2, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface VideoCard {
  level: number;
  name: string;
  icon: string;
  earnPerHour: number;
  storageHours: number;
  cost: number;
  description: string;
}

interface MiningState {
  miningLevel: number;
  currentCard: VideoCard | null;
  nextCard: VideoCard | null;
  accumulated: number;
  maxStorageTokens: number;
  storageFullPercent: number;
  storageTimeLeftSec: number;
  lastClaimAt: number;
}

interface FarmingModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

export const FarmingModal: React.FC<FarmingModalProps> = ({
  isOpen,
  onClose,
  balance,
  onBalanceUpdate,
}) => {
  const [state, setState] = useState<MiningState | null>(null);
  const [allCards, setAllCards] = useState<VideoCard[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  // Load farm state
  const loadStatus = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        state: MiningState;
        allCards: VideoCard[];
      }>('/api/farming/status');

      if (res.success) {
        setState(res.state);
        setAllCards(res.allCards);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки фермы');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadStatus();
      const timer = setInterval(() => {
        // Increment accumulated tokens locally for smooth ticking
        setState((prev) => {
          if (!prev || !prev.currentCard || prev.accumulated >= prev.maxStorageTokens) return prev;
          const ratePerSec = prev.currentCard.earnPerHour / 3600;
          const nextAcc = Math.min(prev.maxStorageTokens, prev.accumulated + ratePerSec);
          const percent = Math.min(100, Math.round((nextAcc / prev.maxStorageTokens) * 100));
          return {
            ...prev,
            accumulated: Math.round(nextAcc * 10000) / 10000,
            storageFullPercent: percent,
          };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Claim tokens
  const handleClaim = async () => {
    if (!state || state.accumulated <= 0 || claiming) return;

    try {
      setClaiming(true);
      setError(null);
      hapticImpact('medium');

      const res = await apiRequest<{
        success: boolean;
        claimed: number;
        balance: number;
        state: MiningState;
      }>('/api/farming/claim', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        setState(res.state);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#38bdf8', '#10b981', '#f59e0b'],
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка сбора прибыли');
    } finally {
      setClaiming(false);
    }
  };

  // Buy or Upgrade card
  const handleUpgrade = async () => {
    if (!state || !state.nextCard || balance < state.nextCard.cost || upgrading) return;

    try {
      setUpgrading(true);
      setError(null);
      hapticImpact('heavy');

      const res = await apiRequest<{
        success: boolean;
        newLevel: number;
        balance: number;
        state: MiningState;
      }>('/api/farming/upgrade', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        setState(res.state);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 75,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#a855f7', '#38bdf8', '#eab308'],
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка улучшения фермы');
    } finally {
      setUpgrading(false);
    }
  };

  const formatHours = (seconds: number) => {
    if (seconds <= 0) return 'Склад заполнен';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}ч ${m}м до заполнения`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/30">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-1.5">
                Майнинг-ферма 🏭
              </h2>
              <p className="text-xs text-slate-400">Оффлайн-доход от видеокарт</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pt-3 space-y-4 pr-0.5 scrollbar-thin">
          {/* Active Rig Status Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-800/90 to-slate-900 border border-sky-500/20 shadow-lg relative overflow-hidden">
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

            {state?.currentCard ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{state.currentCard.icon}</span>
                    <div>
                      <div className="text-sm font-black text-white">{state.currentCard.name}</div>
                      <div className="text-[11px] text-emerald-400 font-mono font-bold">
                        +{state.currentCard.earnPerHour} T / час
                      </div>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold uppercase tracking-wider">
                    Уровень {state.miningLevel}
                  </span>
                </div>

                {/* Storage Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-sky-400" />
                      Склад ({state.currentCard.storageHours}ч)
                    </span>
                    <span className="text-sky-300 font-bold">
                      {formatTokens(state.accumulated)} / {formatTokens(state.maxStorageTokens)} T
                    </span>
                  </div>

                  <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${state.storageFullPercent}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span>Заполнено: {state.storageFullPercent}%</span>
                    <span>{formatHours(state.storageTimeLeftSec)}</span>
                  </div>
                </div>

                {/* Claim Button */}
                <button
                  onClick={handleClaim}
                  disabled={claiming || state.accumulated <= 0}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all"
                >
                  <Zap className="w-4 h-4 fill-current text-white" />
                  <span>
                    {claiming
                      ? 'Сбор...'
                      : state.accumulated > 0
                      ? `Собрать прибыль (+${formatTokens(state.accumulated)} T)`
                      : 'Склад пуст'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="text-center py-4 space-y-2">
                <div className="text-3xl">🔌</div>
                <div className="text-sm font-bold text-slate-200">Ферма пока отключена</div>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Купите первую видеокарту ниже, чтобы начать пассивно добывать Токены каждые 3–8 часов!
                </p>
              </div>
            )}
          </div>

          {/* Upgrades Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs px-1 font-bold text-slate-300">
              <span>Видеокарты фермы</span>
              <span className="text-[11px] text-slate-400 font-normal">
                Баланс: <strong className="text-emerald-400 font-mono">{formatTokens(balance)}</strong> T
              </span>
            </div>

            <div className="space-y-2">
              {allCards.map((card) => {
                const isOwned = (state?.miningLevel || 0) >= card.level;
                const isCurrent = state?.miningLevel === card.level;
                const isNext = (state?.miningLevel || 0) + 1 === card.level;
                const canAfford = balance >= card.cost;

                return (
                  <div
                    key={card.level}
                    className={`p-3 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-sky-950/30 border-sky-500/40 shadow-md shadow-sky-500/10'
                        : isOwned
                        ? 'bg-slate-900/40 border-emerald-500/20 opacity-70'
                        : isNext
                        ? 'bg-slate-800/80 border-white/20'
                        : 'bg-slate-900/30 border-white/5 opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="text-2xl mt-0.5">{card.icon}</div>
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                            <span>{card.name}</span>
                            {isCurrent && (
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                ТЕКУЩАЯ
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Доход: <span className="text-emerald-400 font-mono font-bold">+{card.earnPerHour} T/ч</span> • Склад: <span className="text-sky-300 font-mono">{card.storageHours}ч</span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                            {card.description}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end">
                        {isOwned ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Куплено
                          </span>
                        ) : isNext ? (
                          <button
                            onClick={handleUpgrade}
                            disabled={upgrading || !canAfford}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                              canAfford
                                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-white shadow-md shadow-sky-500/25 active:scale-95'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                            }`}
                          >
                            <span>{upgrading ? 'Покупка...' : `${formatTokens(card.cost)} T`}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-600 px-2 py-1">
                            {formatTokens(card.cost)} T
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
