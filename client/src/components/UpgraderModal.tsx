import React, { useState } from 'react';
import { X, Zap, ArrowRight, Check } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../lib/api.js';
import { formatTokens } from '../lib/formatters.js';
import type { UpgradeConfig, UserProfile } from '../hooks/useClicker.js';
import { useTelegram } from '../hooks/useTelegram.js';

interface UpgraderModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  nextUpgrade: UpgradeConfig | null;
  allUpgrades: UpgradeConfig[];
  onUpgradeSuccess: (updatedUser: UserProfile, nextNext: UpgradeConfig | null) => void;
}

export const UpgraderModal: React.FC<UpgraderModalProps> = ({
  isOpen,
  onClose,
  profile,
  nextUpgrade,
  allUpgrades,
  onUpgradeSuccess,
}) => {
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hapticNotification } = useTelegram();

  if (!isOpen || !profile) return null;

  const canAfford = nextUpgrade ? profile.balance >= nextUpgrade.cost : false;

  const handleBuy = async () => {
    if (!nextUpgrade || !canAfford || buying) return;

    try {
      setBuying(true);
      setError(null);
      const res = await apiRequest<{
        success: boolean;
        user: UserProfile;
        nextUpgrade: UpgradeConfig | null;
      }>('/api/user/upgrade', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        hapticNotification('success');
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
        });
        onUpgradeSuccess(res.user, res.nextUpgrade);
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка покупки улучшения');
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121722] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#161c2b]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Upgrader</h2>
              <p className="text-[11px] text-slate-400">Увеличивайте доход за каждый тап</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Current Income Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-sky-950/40 to-indigo-950/40 border border-sky-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Текущий доход
              </span>
              <div className="text-xl font-black text-sky-400 mt-0.5">
                +{profile.earn_per_click >= 1 ? profile.earn_per_click : profile.earn_per_click.toFixed(3)} Токен
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Уровень
              </span>
              <div className="text-xl font-bold text-white mt-0.5">
                {profile.upgrade_level}
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {error}
            </div>
          )}

          {/* Next Upgrade Action */}
          {nextUpgrade ? (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{nextUpgrade.title}</h3>
                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-300">
                    <span className="text-slate-400">+{profile.earn_per_click}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-sky-400" />
                    <span className="font-bold text-emerald-400">+{nextUpgrade.earnPerClick} / тап</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Цена</span>
                  <div className="text-base font-black text-amber-300">
                    {formatTokens(nextUpgrade.cost)} Т
                  </div>
                </div>
              </div>

              <button
                disabled={!canAfford || buying}
                onClick={handleBuy}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  canAfford
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 cursor-pointer active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                }`}
              >
                <Zap className="w-4 h-4 fill-current" />
                {buying
                  ? 'Покупка...'
                  : canAfford
                  ? `Улучшить за ${formatTokens(nextUpgrade.cost)} Токенов`
                  : `Нужно ещё ${formatTokens(Math.max(0, nextUpgrade.cost - profile.balance))} Токенов`}
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-emerald-400 text-sm font-bold">
              🎉 Поздравляем! Вы достигли максимального уровня прокачки!
            </div>
          )}

          {/* Upgrade Progression Tree */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs uppercase tracking-wider text-slate-400 font-semibold px-1">
              Все уровни улучшений
            </h4>
            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
              {allUpgrades.map((u) => {
                const isCompleted = profile.upgrade_level >= u.level;
                const isNext = nextUpgrade?.level === u.level;

                return (
                  <div
                    key={u.level}
                    className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition border ${
                      isCompleted
                        ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-300'
                        : isNext
                        ? 'bg-sky-950/30 border-sky-500/30 text-white font-medium'
                        : 'bg-slate-900/40 border-white/5 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          isCompleted
                            ? 'bg-emerald-500 text-black'
                            : isNext
                            ? 'bg-sky-500 text-black'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3 h-3" /> : u.level}
                      </div>
                      <span>{u.title}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] text-sky-400">
                        +{u.earnPerClick}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 w-16 text-right">
                        {u.cost === 0 ? 'Бесплатно' : `${formatTokens(u.cost)} Т`}
                      </span>
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
