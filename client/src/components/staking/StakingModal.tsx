import React, { useState, useEffect } from 'react';
import { Vault, X, Clock, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface StakingDeposit {
  id: number;
  user_id: number;
  amount: number;
  term_days: number;
  interest_percent: number;
  start_time: number;
  end_time: number;
  status: 'active' | 'completed' | 'early_withdrawn';
  profit: number;
  totalPayout: number;
  isMatured: boolean;
  remainingMs: number;
}

interface StakingModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

const PLANS = [
  { days: 7, percent: 5, badge: 'Быстрый', color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/40 text-cyan-300' },
  { days: 14, percent: 12, badge: 'Оптимальный', color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/40 text-emerald-300' },
  { days: 30, percent: 30, badge: 'Максимум', color: 'from-amber-500/20 to-orange-500/10 border-amber-500/40 text-amber-300' },
];

export const StakingModal: React.FC<StakingModalProps> = ({
  isOpen,
  onClose,
  balance,
  onBalanceUpdate,
}) => {
  const [selectedTerm, setSelectedTerm] = useState<number>(14);
  const [depositAmount, setDepositAmount] = useState<string>('10');
  const [deposits, setDeposits] = useState<StakingDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      loadState();
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const loadState = async () => {
    try {
      const res = await apiRequest<{ deposits: StakingDeposit[] }>('/api/staking/state');
      if (res && res.deposits) {
        setDeposits(res.deposits);
      }
    } catch (err: any) {
      // ignore
    }
  };

  const selectedPlan = PLANS.find((p) => p.days === selectedTerm) || PLANS[1];
  const numAmount = parseFloat(depositAmount) || 0;
  const estimatedProfit = Math.round((numAmount * (selectedPlan.percent / 100)) * 10000) / 10000;
  const estimatedTotal = Math.round((numAmount + estimatedProfit) * 10000) / 10000;

  const handleCreateDeposit = async () => {
    if (numAmount < 1.0) {
      setError('Минимальная сумма депозита: 1.0 Т');
      return;
    }
    if (numAmount > balance) {
      setError('Недостаточно токенов на балансе');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await apiRequest<{ success: boolean; newBalance: number; deposits: StakingDeposit[] }>(
        '/api/staking/deposit',
        {
          method: 'POST',
          body: JSON.stringify({ amount: numAmount, termDays: selectedTerm }),
        }
      );

      if (res.success) {
        onBalanceUpdate(res.newBalance);
        setDeposits(res.deposits);
        soundManager.playVictoryFanfare();
        hapticNotification('success');
        confetti({ particleCount: 30, spread: 60 });
        setSuccessMsg(`Успешно открыт депозит на ${selectedTerm} дней (+${selectedPlan.percent}%)!`);
        setDepositAmount('10');
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка создания депозита');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (depositId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; newBalance: number; payout: number; profit: number; deposits: StakingDeposit[] }>(
        '/api/staking/claim',
        {
          method: 'POST',
          body: JSON.stringify({ depositId }),
        }
      );
      if (res.success) {
        onBalanceUpdate(res.newBalance);
        setDeposits(res.deposits);
        soundManager.playVictoryFanfare();
        hapticNotification('success');
        confetti({ particleCount: 60, spread: 80 });
        setSuccessMsg(`Депозит успешно закрыт! Начислено: +${formatTokens(res.payout)} Т`);
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка выплаты');
    } finally {
      setLoading(false);
    }
  };

  const handleEarlyWithdraw = async (depositId: number) => {
    if (!window.confirm('Внимание! При досрочном выводе вся начисленная прибыль сгорит. Вывести только тело депозита?')) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{ success: boolean; newBalance: number; returnedPrincipal: number; deposits: StakingDeposit[] }>(
        '/api/staking/withdraw-early',
        {
          method: 'POST',
          body: JSON.stringify({ depositId }),
        }
      );
      if (res.success) {
        onBalanceUpdate(res.newBalance);
        setDeposits(res.deposits);
        hapticImpact('medium');
        setSuccessMsg(`Досрочно возвращено тело депозита: +${formatTokens(res.returnedPrincipal)} Т`);
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка досрочного вывода');
    } finally {
      setLoading(false);
    }
  };

  const formatRemaining = (ms: number) => {
    if (ms <= 0) return 'Готов к выплате!';
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (days > 0) return `${days} д. ${hours} ч.`;
    return `${hours} ч. ${mins} мин.`;
  };

  if (!isOpen) return null;

  const activeDeposits = deposits.filter((d) => d.status === 'active');
  const pastDeposits = deposits.filter((d) => d.status !== 'active');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-emerald-500/30 rounded-3xl p-5 shadow-2xl shadow-emerald-500/10 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
              <Vault className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wide">Крипто-Сейф</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                  APY STAKING
                </span>
              </div>
              <p className="text-xs text-slate-400">Заморозка токенов под гарантированный процент</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Deposit Creation Card */}
        <div className="mt-4 bg-slate-900/60 border border-white/5 rounded-2xl p-4">
          <div className="text-xs font-bold text-slate-300 mb-2.5 flex items-center justify-between">
            <span>Выберите тариф депозита:</span>
            <span className="text-slate-400 font-mono">
              Баланс: <strong className="text-emerald-400">{formatTokens(balance)}</strong> Т
            </span>
          </div>

          {/* Plan selection buttons */}
          <div className="grid grid-cols-3 gap-2 mb-3.5">
            {PLANS.map((plan) => {
              const isSelected = selectedTerm === plan.days;
              return (
                <button
                  key={plan.days}
                  type="button"
                  onClick={() => {
                    setSelectedTerm(plan.days);
                    hapticImpact('light');
                  }}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    isSelected
                      ? `bg-gradient-to-b ${plan.color} ring-2 ring-emerald-400/50 shadow-lg`
                      : 'bg-slate-950/80 border-white/5 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{plan.badge}</div>
                  <div className="text-lg font-black font-mono my-0.5 text-white">+{plan.percent}%</div>
                  <div className="text-xs text-slate-400 font-semibold">{plan.days} дней</div>
                </button>
              );
            })}
          </div>

          {/* Amount input */}
          <div className="space-y-1.5 mb-3.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Сумма депозита (мин. 1.0 Т)</span>
              <button
                type="button"
                onClick={() => setDepositAmount(String(Math.floor(balance)))}
                className="text-emerald-400 hover:underline font-mono text-[11px]"
              >
                Всё ({Math.floor(balance)} Т)
              </button>
            </div>
            <div className="relative">
              <input
                type="number"
                min="1"
                step="1"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="10"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                ТОКЕН
              </span>
            </div>
          </div>

          {/* Estimated profit banner */}
          <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 flex items-center justify-between text-xs font-mono mb-3.5">
            <div>
              <div className="text-slate-500 text-[10px]">Прибыль (+{selectedPlan.percent}%)</div>
              <div className="text-emerald-400 font-bold">+{formatTokens(estimatedProfit)} Т</div>
            </div>
            <div className="text-right">
              <div className="text-slate-500 text-[10px]">Итоговая выплата</div>
              <div className="text-white font-black text-sm">{formatTokens(estimatedTotal)} Т</div>
            </div>
          </div>

          {/* Open Deposit Button */}
          <button
            type="button"
            disabled={loading || numAmount < 1.0 || numAmount > balance}
            onClick={handleCreateDeposit}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/25 transition active:scale-98 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Заморозить в Сейфе
          </button>
        </div>

        {/* Active Deposits List */}
        <div className="mt-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            Активные депозиты ({activeDeposits.length})
          </h3>

          {activeDeposits.length === 0 ? (
            <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl text-center text-xs text-slate-500">
              У вас пока нет активных депозитов в сейфе.
            </div>
          ) : (
            <div className="space-y-2">
              {activeDeposits.map((dep) => (
                <div
                  key={dep.id}
                  className="p-3 bg-slate-900/70 border border-emerald-500/20 rounded-xl flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-white text-sm">{formatTokens(dep.amount)} Т</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold font-mono">
                        +{dep.interest_percent}%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Срок: {dep.term_days} дн. • Доход: <strong className="text-emerald-400 font-mono">+{formatTokens(dep.profit)} Т</strong>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {formatRemaining(dep.remainingMs)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 items-end">
                    {dep.isMatured ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleClaim(dep.id)}
                        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-lg shadow-md shadow-emerald-500/30 transition active:scale-95 cursor-pointer"
                      >
                        Забрать {formatTokens(dep.totalPayout)} Т
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleEarlyWithdraw(dep.id)}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-white/5 hover:border-rose-500/30 text-[10px] rounded-lg transition cursor-pointer"
                      >
                        Досрочно
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past history */}
        {pastDeposits.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/5">
            <span className="text-[11px] text-slate-500 font-bold block mb-2">История закрытых вкладов:</span>
            <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
              {pastDeposits.slice(0, 5).map((dep) => (
                <div
                  key={dep.id}
                  className="p-2 bg-slate-950/50 rounded-lg flex items-center justify-between text-[11px] font-mono text-slate-400"
                >
                  <span>{formatTokens(dep.amount)} Т ({dep.term_days} д.)</span>
                  <span className={dep.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'}>
                    {dep.status === 'completed' ? `+${formatTokens(dep.profit)} Т` : 'Возврат тела'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
