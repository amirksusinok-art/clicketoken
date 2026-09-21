import React, { useState, useEffect } from 'react';
import { X, Gift, Check, Lock, Flame, Clock, Sparkles, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface DailyState {
  streak: number;
  canClaim: boolean;
  remainingMs: number;
  nextRewardDay: number;
  nextRewardAmount: number;
  rewards: number[];
}

interface DailyStreakModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}

export const DailyStreakModal: React.FC<DailyStreakModalProps> = ({
  isOpen,
  onClose,
  onBalanceUpdate,
}) => {
  const [state, setState] = useState<DailyState | null>(null);
  const [loading, setLoading] = useState(false);
  const [claimedReward, setClaimedReward] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { hapticNotification } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      loadState();
      setClaimedReward(null);
      setError(null);
    }
  }, [isOpen]);

  const loadState = async () => {
    try {
      const res = await apiRequest<DailyState>('/api/daily/state');
      setState(res);
    } catch (err: any) {
      // ignore
    }
  };

  const handleClaim = async () => {
    if (!state || !state.canClaim) return;

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{
        success: boolean;
        rewardAmount: number;
        newStreak: number;
        newBalance: number;
        dayClaimed: number;
        state: DailyState;
      }>('/api/daily/claim', { method: 'POST' });

      if (res.success) {
        onBalanceUpdate(res.newBalance);
        setState(res.state);
        setClaimedReward(res.rewardAmount);
        soundManager.playVictoryFanfare();
        hapticNotification('success');
        confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка получения награды');
    } finally {
      setLoading(false);
    }
  };

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Сейчас';
    const totalSecs = Math.floor(ms / 1000);
    const hours = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const currentStreak = state?.streak || 0;
  const nextDay = state?.nextRewardDay || 1;
  const rewards = state?.rewards || [0.1, 0.25, 0.5, 1.0, 2.0, 3.5, 5.0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-amber-500/30 rounded-3xl p-5 shadow-2xl shadow-amber-500/10">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <Flame className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wide">Ежедневный Стрик</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  {currentStreak} ДН. ПОДРЯД
                </span>
              </div>
              <p className="text-xs text-slate-400">Заходите каждый день и умножайте награды!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mt-3 p-3 bg-rose-950/70 border border-rose-500/50 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Claimed banner */}
        {claimedReward !== null && (
          <div className="mt-3 p-3 bg-emerald-950/70 border border-emerald-500/50 rounded-2xl text-center animate-scaleUp">
            <Sparkles className="w-6 h-6 text-amber-400 mx-auto mb-1 animate-spin" />
            <div className="text-xs text-emerald-300 font-bold">Награда успешно получена!</div>
            <div className="text-xl font-black font-mono text-white mt-0.5">+{formatTokens(claimedReward)} Т</div>
          </div>
        )}

        {/* 7 Days Grid */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {rewards.map((rew, index) => {
            const dayNum = index + 1;
            const isDay7 = dayNum === 7;
            const completedDaysInCurrentWeek = currentStreak % 7;
            
            // Check status
            let isClaimed = false;
            let isToday = false;

            if (state?.canClaim) {
              if (dayNum < nextDay) isClaimed = true;
              else if (dayNum === nextDay) isToday = true;
            } else {
              if (dayNum <= completedDaysInCurrentWeek && completedDaysInCurrentWeek > 0) isClaimed = true;
              else if (dayNum === completedDaysInCurrentWeek + 1) isToday = false;
            }

            return (
              <div
                key={dayNum}
                className={`relative p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center transition ${
                  isDay7 ? 'col-span-2 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-amber-400/60 shadow-lg shadow-amber-500/10' : ''
                } ${
                  isClaimed
                    ? 'bg-slate-950/60 border-emerald-500/30 opacity-70'
                    : isToday
                    ? 'bg-gradient-to-b from-amber-500/25 to-yellow-500/15 border-amber-400 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20 animate-pulse'
                    : 'bg-slate-950/80 border-white/5 opacity-50'
                }`}
              >
                {/* Day label */}
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  День {dayNum}
                </div>

                {/* Center Icon / Value */}
                <div className="my-1.5 flex flex-col items-center">
                  {isClaimed ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : isToday ? (
                    <div className="w-7 h-7 rounded-full bg-amber-500/30 flex items-center justify-center text-amber-300">
                      <Gift className="w-4 h-4 animate-bounce" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-800/40 flex items-center justify-center text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>

                {/* Amount */}
                <div className={`font-mono font-black text-xs ${isDay7 ? 'text-amber-300 text-sm' : 'text-white'}`}>
                  +{rew} Т
                </div>
              </div>
            );
          })}
        </div>

        {/* Claim Action or Countdown Banner */}
        <div className="mt-5">
          {state?.canClaim ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleClaim}
              className="w-full py-3.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/30 transition active:scale-98 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              <Gift className="w-5 h-5 text-slate-950" />
              Забрать награду за {nextDay}-й день (+{state.nextRewardAmount} Т)
            </button>
          ) : (
            <div className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-center gap-2.5 text-xs text-slate-400 font-mono">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Следующая награда через:</span>
              <strong className="text-white font-bold">{formatCountdown(state?.remainingMs || 0)}</strong>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
