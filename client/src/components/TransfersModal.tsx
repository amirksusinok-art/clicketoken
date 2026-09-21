import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, History, ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import { formatTokens } from '../lib/formatters.js';
import type { UserProfile } from '../hooks/useClicker.js';
import { useTelegram } from '../hooks/useTelegram.js';

interface TransferItem {
  id: number;
  from_user_id: number;
  from_username: string | null;
  to_user_id: number;
  to_username: string | null;
  amount: number;
  created_at: number;
}

interface TransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onTransferSuccess: (newBalance: number) => void;
  initialRecipient?: string;
}

export const TransfersModal: React.FC<TransfersModalProps> = ({
  isOpen,
  onClose,
  profile,
  onTransferSuccess,
  initialRecipient,
}) => {
  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [username, setUsername] = useState(initialRecipient || '');
  const [amount, setAmount] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialRecipient) {
      setUsername(initialRecipient);
    }
  }, [initialRecipient, isOpen]);

  const [history, setHistory] = useState<TransferItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { hapticNotification } = useTelegram();

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await apiRequest<{ history: TransferItem[] }>('/api/transfers/history');
      setHistory(res.history);
    } catch (err) {
      console.error('Failed to load transfers history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
      setConfirmStep(false);
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, fetchHistory]);

  if (!isOpen || !profile) return null;

  const numAmount = parseFloat(amount || '0');
  const isValidAmount = numAmount > 0 && numAmount <= profile.balance;
  const cleanUsername = username.replace(/^@/, '').trim();

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!cleanUsername) {
      setError('Введите @username получателя');
      return;
    }
    if (!isValidAmount) {
      setError('Недостаточно токенов или указана некорректная сумма');
      return;
    }

    setConfirmStep(true);
  };

  const handleExecuteSend = async () => {
    if (sending) return;

    try {
      setSending(true);
      setError(null);

      const res = await apiRequest<{
        success: boolean;
        message: string;
        balance: number;
        transfer: TransferItem;
      }>('/api/transfers/send', {
        method: 'POST',
        body: JSON.stringify({
          toUsername: cleanUsername,
          amount: numAmount,
        }),
      });

      if (res.success) {
        hapticNotification('success');
        setSuccessMsg(res.message);
        onTransferSuccess(res.balance);
        setUsername('');
        setAmount('');
        setConfirmStep(false);
        fetchHistory();
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка отправки перевода');
      setConfirmStep(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121722] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#161c2b]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Переводы</h2>
              <p className="text-[11px] text-slate-400">Отправляйте Токены другим игрокам</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-white/5 bg-slate-900/40 px-5 pt-2">
          <button
            onClick={() => {
              setTab('send');
              setConfirmStep(false);
            }}
            className={`pb-2.5 px-4 text-xs font-bold transition border-b-2 cursor-pointer ${
              tab === 'send'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Отправить
          </button>
          <button
            onClick={() => setTab('history')}
            className={`pb-2.5 px-4 text-xs font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${
              tab === 'history'
                ? 'border-sky-400 text-sky-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            История
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {tab === 'send' ? (
            confirmStep ? (
              /* Confirmation Screen */
              <div className="space-y-4 p-4 rounded-xl bg-slate-900/80 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Подтверждение перевода</h3>
                    <p className="text-xs text-slate-300 mt-1">
                      Вы отправляете{' '}
                      <span className="font-bold text-amber-300">
                        {formatTokens(numAmount)} Токенов
                      </span>{' '}
                      пользователю{' '}
                      <span className="font-bold text-sky-400">@{cleanUsername}</span>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    disabled={sending}
                    onClick={() => setConfirmStep(false)}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
                  >
                    Отмена
                  </button>
                  <button
                    disabled={sending}
                    onClick={handleExecuteSend}
                    className="flex-1 py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                  >
                    {sending ? 'Отправка...' : 'Подтвердить'}
                  </button>
                </div>
              </div>
            ) : (
              /* Send Form */
              <form onSubmit={handleOpenConfirm} className="space-y-4">
                {/* Available Balance */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs">
                  <span className="text-slate-400">Доступно:</span>
                  <span className="font-bold text-sky-400 font-mono">
                    {formatTokens(profile.balance)} Токенов
                  </span>
                </div>

                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    {error}
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Recipient input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Получатель (@username)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      value={cleanUsername}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition"
                    />
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Количество Токенов
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.000"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono transition"
                  />
                  {/* Quick amount pills */}
                  <div className="flex gap-1.5 pt-1">
                    {[5, 10, 50, 100].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmount(String(val))}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-mono cursor-pointer transition"
                      >
                        +{val}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAmount(String(profile.balance))}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-[11px] font-bold cursor-pointer transition ml-auto"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isValidAmount || !cleanUsername}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
                    isValidAmount && cleanUsername
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Отправить
                </button>
              </form>
            )
          ) : (
            /* History List */
            <div className="space-y-2">
              {loadingHistory ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  Загрузка истории переводов...
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  У вас пока нет совершённых переводов
                </div>
              ) : (
                history.map((tx) => {
                  const isIncoming = tx.to_user_id === profile.id;
                  const dateStr = new Date(tx.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            isIncoming
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-rose-500/10 text-rose-400'
                          }`}
                        >
                          {isIncoming ? (
                            <ArrowDownLeft className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200">
                            {isIncoming
                              ? `От @${tx.from_username || 'пользователя'}`
                              : `Кому @${tx.to_username || 'пользователю'}`}
                          </div>
                          <div className="text-[10px] text-slate-500">{dateStr}</div>
                        </div>
                      </div>

                      <div
                        className={`font-mono font-bold ${
                          isIncoming ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {isIncoming ? '+' : '−'}
                        {formatTokens(tx.amount)} Токен
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
