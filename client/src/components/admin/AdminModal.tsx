import React, { useState, useEffect } from 'react';
import { Crown, X, Search, PlusCircle, RefreshCw, BarChart3, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  myUserId: number;
  currentBalance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

interface AdminStats {
  totalUsers: number;
  totalBalance: number;
  activeStakingDeposits: number;
  activeStakingVolume: number;
  totalGamesPlayed: number;
  totalTransfers: number;
}

interface TargetUser {
  id: number;
  username: string | null;
  first_name: string;
  balance: number;
  earn_per_click: number;
  upgrade_level: number;
  mining_level: number;
  daily_streak: number;
  created_at: number;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  myUserId,
  currentBalance,
  onBalanceUpdate,
}) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [foundUser, setFoundUser] = useState<TargetUser | null>(null);
  const [amountInput, setAmountInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  useEffect(() => {
    if (isOpen) {
      loadStats();
      setMsg(null);
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      const res = await apiRequest<AdminStats>('/api/admin/stats');
      setStats(res);
    } catch (err: any) {
      // ignore
    }
  };

  const handleSelfTopup = async (addAmount: number) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await apiRequest<{ success: boolean; user: { balance: number } }>('/api/admin/add-balance', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: myUserId, amount: addAmount }),
      });
      if (res.success && res.user) {
        onBalanceUpdate(res.user.balance);
        soundManager.playVictoryFanfare();
        hapticNotification('success');
        setMsg({ text: `Успешно начислено +${addAmount.toLocaleString()} Т на ваш баланс!`, type: 'success' });
        loadStats();
      }
    } catch (err: any) {
      hapticNotification('error');
      setMsg({ text: err.message || 'Ошибка пополнения', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchUser = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setMsg(null);
    try {
      const res = await apiRequest<{ user: TargetUser }>('/api/admin/search-user', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      setFoundUser(res.user);
      hapticImpact('light');
    } catch (err: any) {
      setFoundUser(null);
      hapticNotification('error');
      setMsg({ text: err.message || 'Игрок не найден', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleModifyTarget = async (mode: 'add' | 'set' | 'reset') => {
    if (!foundUser) return;
    const num = parseFloat(amountInput);

    if (mode !== 'reset' && (isNaN(num) || num < 0)) {
      setMsg({ text: 'Введите корректное число', type: 'error' });
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      const endpoint = mode === 'add' ? '/api/admin/add-balance' : '/api/admin/set-balance';
      const body =
        mode === 'add'
          ? { targetUserId: foundUser.id, amount: num }
          : { targetUserId: foundUser.id, newBalance: mode === 'reset' ? 0 : num };

      const res = await apiRequest<{ success: boolean; user: { balance: number } }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (res.success && res.user) {
        setFoundUser({ ...foundUser, balance: res.user.balance });
        if (foundUser.id === myUserId) {
          onBalanceUpdate(res.user.balance);
        }
        hapticNotification('success');
        setMsg({ text: `Баланс игрока успешно обновлен: ${formatTokens(res.user.balance)} Т`, type: 'success' });
        setAmountInput('');
        loadStats();
      }
    } catch (err: any) {
      hapticNotification('error');
      setMsg({ text: err.message || 'Ошибка обновления баланса', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl shadow-amber-500/10 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20">
              <Crown className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-amber-400 uppercase tracking-wide">Панель Создателя</h2>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                  VIP ROOT
                </span>
              </div>
              <p className="text-xs text-slate-400">Telegram ID: <span className="font-mono text-amber-300">{myUserId}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback message banner */}
        {msg && (
          <div
            className={`mt-3 p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
              msg.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        {/* Section 1: Quick Self Top-up */}
        <div className="mt-4 bg-slate-900/70 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <PlusCircle className="w-4 h-4 text-amber-400" />
              Быстрое пополнение себе
            </span>
            <span className="text-xs font-mono text-slate-400">
              Баланс: <strong className="text-amber-400">{formatTokens(currentBalance)}</strong> Т
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[100, 1000, 10000, 100000].map((amt) => (
              <button
                key={amt}
                disabled={loading}
                onClick={() => handleSelfTopup(amt)}
                className="py-2.5 bg-gradient-to-b from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 border border-amber-500/40 rounded-xl text-xs font-mono font-black text-amber-300 transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                +{amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}
          </div>
        </div>

        {/* Section 2: Manage Any Player */}
        <div className="mt-4 bg-slate-900/70 border border-white/5 rounded-2xl p-4">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mb-2.5">
            <ShieldCheck className="w-4 h-4 text-sky-400" />
            Управление балансом игроков
          </span>

          <form onSubmit={handleSearchUser} className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="@username или ID игрока..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchQuery.trim()}
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              Найти
            </button>
          </form>

          {foundUser && (
            <div className="p-3 bg-slate-950/80 border border-sky-500/30 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <span>{foundUser.first_name}</span>
                    {foundUser.username && (
                      <span className="text-sky-400 font-mono">@{foundUser.username}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">ID: {foundUser.id}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-slate-400">Баланс:</div>
                  <div className="font-mono font-black text-amber-400 text-sm">
                    {formatTokens(foundUser.balance)} Т
                  </div>
                </div>
              </div>

              {/* Amount input & actions */}
              <div className="space-y-2">
                <input
                  type="number"
                  step="any"
                  placeholder="Количество токенов..."
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={loading || !amountInput}
                    onClick={() => handleModifyTarget('add')}
                    className="py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
                  >
                    + Добавить
                  </button>
                  <button
                    type="button"
                    disabled={loading || !amountInput}
                    onClick={() => handleModifyTarget('set')}
                    className="py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
                  >
                    = Установить
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleModifyTarget('reset')}
                    className="py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40"
                  >
                    0 Сбросить
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 3: System Analytics */}
        <div className="mt-4 bg-slate-900/70 border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Статистика экосистемы
            </span>
            <button
              onClick={loadStats}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <RefreshCw className="w-3 h-3" />
              Обновить
            </button>
          </div>

          {stats ? (
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5">
                <div className="text-[10px] text-slate-500">Всего игроков</div>
                <div className="text-base font-black text-white">{stats.totalUsers.toLocaleString()}</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5">
                <div className="text-[10px] text-slate-500">Всего токенов на руках</div>
                <div className="text-base font-black text-amber-400">{formatTokens(stats.totalBalance)} Т</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5">
                <div className="text-[10px] text-slate-500">Депозиты в сейфе</div>
                <div className="text-base font-black text-cyan-400">{stats.activeStakingDeposits} ({formatTokens(stats.activeStakingVolume)} Т)</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5">
                <div className="text-[10px] text-slate-500">Сыграно мини-игр</div>
                <div className="text-base font-black text-purple-400">{stats.totalGamesPlayed.toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-xs text-slate-500">Загрузка данных...</div>
          )}
        </div>

      </div>
    </div>
  );
};
