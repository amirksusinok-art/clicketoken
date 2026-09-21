import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  Clock,
  Zap,
  ArrowUpRight,
  CheckCircle2,
  ShieldAlert,
  Lock,
  Sparkles,
  Server,
  Flame,
} from 'lucide-react';
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

interface GoldenMiningState {
  hasLicense: boolean;
  canUnlock: boolean;
  cost: number;
  earnPerHour: number;
  storageHours: number;
  requiredMiningLevel: number;
  accumulated: number;
  maxStorageTokens: number;
  storageFullPercent: number;
  storageTimeLeftSec: number;
  lastClaimAt?: number;
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
  const [activeTab, setActiveTab] = useState<'gpu' | 'asic'>('gpu');
  const [state, setState] = useState<MiningState | null>(null);
  const [goldenState, setGoldenState] = useState<GoldenMiningState | null>(null);
  const [allCards, setAllCards] = useState<VideoCard[]>([]);
  const [claiming, setClaiming] = useState(false);
  const [claimingGolden, setClaimingGolden] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [buyingLicense, setBuyingLicense] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  // Load farm state
  const loadStatus = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        state: MiningState;
        goldenState: GoldenMiningState;
        allCards: VideoCard[];
      }>('/api/farming/status');

      if (res.success) {
        setState(res.state);
        setGoldenState(res.goldenState);
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
        // Increment GPU accumulated tokens locally for smooth ticking
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

        // Increment Golden ASIC accumulated tokens locally
        setGoldenState((prev) => {
          if (!prev || !prev.hasLicense || prev.accumulated >= prev.maxStorageTokens) return prev;
          const ratePerSec = prev.earnPerHour / 3600;
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

  // Claim GPU farm tokens
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
        soundManager.playSuccess();
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка сбора токенов');
    } finally {
      setClaiming(false);
    }
  };

  // Claim Golden ASIC tokens
  const handleClaimGolden = async () => {
    if (!goldenState || goldenState.accumulated <= 0 || claimingGolden) return;

    try {
      setClaimingGolden(true);
      setError(null);
      hapticImpact('heavy');

      const res = await apiRequest<{
        success: boolean;
        claimed: number;
        balance: number;
        goldenState: GoldenMiningState;
      }>('/api/farming/claim-golden', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        setGoldenState(res.goldenState);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#fbbf24', '#eab308'],
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка сбора прибыли ASIC');
    } finally {
      setClaimingGolden(false);
    }
  };

  // Upgrade GPU Farm
  const handleUpgrade = async () => {
    if (upgrading || !state?.nextCard || balance < state.nextCard.cost) return;

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
        // Refresh status so goldenState.canUnlock reflects tier 6
        loadStatus();
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

  // Buy Golden Miner License
  const handleBuyLicense = async () => {
    if (buyingLicense || !goldenState || balance < goldenState.cost) return;

    try {
      setBuyingLicense(true);
      setError(null);
      hapticImpact('heavy');

      const res = await apiRequest<{
        success: boolean;
        balance: number;
        goldenState: GoldenMiningState;
      }>('/api/farming/buy-license', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        setGoldenState(res.goldenState);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 120,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#f59e0b', '#fbbf24', '#fef08a'],
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка покупки золотой лицензии');
    } finally {
      setBuyingLicense(false);
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
              <p className="text-xs text-slate-400">Пассивный оффлайн-доход</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: GPU Farm vs ASIC Datacenter */}
        <div className="grid grid-cols-2 gap-2 mt-3 p-1 bg-slate-950/70 border border-white/10 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('gpu')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'gpu'
                ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white shadow-md shadow-sky-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>GPU Ферма</span>
          </button>

          <button
            onClick={() => setActiveTab('asic')}
            className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all relative ${
              activeTab === 'asic'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-black shadow-md shadow-amber-500/30 font-black'
                : 'text-amber-400 hover:text-amber-300'
            }`}
          >
            {goldenState?.hasLicense ? (
              <Server className="w-3.5 h-3.5 text-current" />
            ) : goldenState?.canUnlock ? (
              <Sparkles className="w-3.5 h-3.5 text-current" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-current" />
            )}
            <span>ASIC Ангар</span>
            {goldenState?.hasLicense && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse absolute top-1.5 right-2" />
            )}
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
          {activeTab === 'gpu' ? (
            /* ================= TAB 1: GPU MINING FARM ================= */
            <>
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
                      className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs uppercase tracking-wider text-white shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
                      Купите первую видеокарту ниже, чтобы начать пассивно добывать Токены!
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
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
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
            </>
          ) : (
            /* ================= TAB 2: ASIC DATA CENTER (GOLDEN LICENSE) ================= */
            <div className="space-y-4">
              {goldenState?.hasLicense ? (
                /* Active ASIC Industrial Facility */
                <div className="p-4 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900 to-yellow-950/30 border-2 border-amber-400/40 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-36 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-2xl shadow-lg shadow-amber-500/40 text-black font-black">
                          🏭
                        </div>
                        <div>
                          <div className="text-sm font-black text-amber-200 uppercase tracking-wide">
                            ASIC Дата-центр
                          </div>
                          <div className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400 animate-bounce" />
                            +100.0 T / час
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Лицензия
                      </span>
                    </div>

                    {/* Industrial Rig visual indicator */}
                    <div className="p-3 bg-black/40 rounded-2xl border border-amber-400/20 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Server className="w-4 h-4 text-amber-400" />
                        <span>Стойки Antminer S21</span>
                      </div>
                      <span className="text-emerald-400 font-bold">100% ONLINE</span>
                    </div>

                    {/* Storage Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          Склад (24 часа)
                        </span>
                        <span className="text-amber-300 font-bold">
                          {formatTokens(goldenState.accumulated)} / {formatTokens(goldenState.maxStorageTokens)} T
                        </span>
                      </div>

                      <div className="w-full h-3.5 bg-slate-950 rounded-full overflow-hidden border border-amber-400/20 p-0.5 shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-emerald-400 rounded-full transition-all duration-500 shadow-md shadow-amber-500/30"
                          style={{ width: `${goldenState.storageFullPercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span>Заполнено: {goldenState.storageFullPercent}%</span>
                        <span>{formatHours(goldenState.storageTimeLeftSec)}</span>
                      </div>
                    </div>

                    {/* Claim Button */}
                    <button
                      onClick={handleClaimGolden}
                      disabled={claimingGolden || goldenState.accumulated <= 0}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed font-black text-xs uppercase tracking-wider text-black shadow-lg shadow-amber-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-black" />
                      <span>
                        {claimingGolden
                          ? 'Сбор...'
                          : goldenState.accumulated > 0
                          ? `Забрать прибыль (+${formatTokens(goldenState.accumulated)} T)`
                          : 'Склад пуст'}
                      </span>
                    </button>
                  </div>
                </div>
              ) : goldenState?.canUnlock ? (
                /* Unlocked for purchase: Golden Miner License Offer */
                <div className="p-4 rounded-3xl bg-gradient-to-b from-amber-950/30 via-slate-900 to-black border-2 border-amber-400/40 shadow-2xl relative overflow-hidden space-y-4">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="text-center space-y-1.5">
                    <div className="inline-block p-3 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-3xl shadow-lg shadow-amber-500/20">
                      🏆
                    </div>
                    <h3 className="text-base font-black text-amber-300 uppercase tracking-wide">
                      Золотая лицензия майнера
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Вы полностью освоили GPU-ферму! Теперь вам доступен промышленный ASIC-ангар.
                    </p>
                  </div>

                  {/* Benefit Cards */}
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Доход в час</div>
                      <div className="text-sm font-mono font-black text-emerald-400 mt-0.5">+100.0 T/ч</div>
                    </div>
                    <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-white/10">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Автономность</div>
                      <div className="text-sm font-mono font-black text-sky-400 mt-0.5">24 часа</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
                    💡 <strong>Пассивный гигант:</strong> До <strong>2,400 Токенов</strong> в сутки без обязательного входа каждые несколько часов!
                  </div>

                  <div className="pt-1">
                    <div className="flex justify-between text-xs px-1 mb-2">
                      <span className="text-slate-400">Стоимость лицензии:</span>
                      <span className="font-mono font-bold text-amber-300">{goldenState.cost} T</span>
                    </div>

                    <button
                      onClick={handleBuyLicense}
                      disabled={buyingLicense || balance < goldenState.cost}
                      className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                        balance >= goldenState.cost
                          ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black shadow-amber-500/30 active:scale-[0.98]'
                          : 'bg-slate-800 text-slate-500 border border-white/5 cursor-not-allowed'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                      {buyingLicense
                        ? 'Покупка...'
                        : balance >= goldenState.cost
                        ? `Купить лицензию за ${goldenState.cost} T`
                        : `Недостаточно токенов (${formatTokens(balance)} / ${goldenState.cost} Т)`}
                    </button>
                  </div>
                </div>
              ) : (
                /* Locked: Requires Level 6 GPU Rig */
                <div className="p-5 rounded-3xl bg-slate-950 border border-white/10 text-center space-y-4 shadow-xl">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500">
                    <Lock className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-200 uppercase tracking-wide">
                      ASIC-ангар заблокирован
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
                      Промышленный цех открывается только после максимальной прокачки обычной фермы (Уровень 6: Quantum Rig 9000).
                    </p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-900/60 border border-white/5 max-w-xs mx-auto">
                    <div className="flex justify-between text-[11px] mb-1.5 font-bold">
                      <span className="text-slate-400">Прогресс GPU-фермы:</span>
                      <span className="text-sky-400 font-mono">{state?.miningLevel || 0} / 6 ур.</span>
                    </div>
                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-sky-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round(((state?.miningLevel || 0) / 6) * 100))}%` }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('gpu')}
                    className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 border border-sky-500/30 transition cursor-pointer"
                  >
                    Перейти к прокачке фермы →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
