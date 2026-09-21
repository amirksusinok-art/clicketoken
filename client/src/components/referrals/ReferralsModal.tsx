import React, { useState, useEffect } from 'react';
import { X, Users, Gift, Share2, Copy, Check, Trophy, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface ReferralFriendItem {
  id: number;
  username: string | null;
  first_name: string;
  bonusPaid: number;
  earnedTotal: number;
  createdAt: number;
}

interface TopInviterItem {
  id: number;
  username: string | null;
  first_name: string;
  friendsCount: number;
  totalEarned: number;
}

interface ReferralsInfo {
  unclaimedBalance: number;
  totalEarned: number;
  friendsCount: number;
  friends: ReferralFriendItem[];
  topInviters: TopInviterItem[];
}

interface ReferralsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBalanceUpdate: (newBalance: number) => void;
}

export const ReferralsModal: React.FC<ReferralsModalProps> = ({
  isOpen,
  onClose,
  onBalanceUpdate,
}) => {
  const [info, setInfo] = useState<ReferralsInfo | null>(null);
  const [referralLink, setReferralLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'friends' | 'leaderboard'>('friends');

  const { hapticImpact, hapticNotification } = useTelegram();

  const loadData = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        referralLink: string;
        info: ReferralsInfo;
      }>('/api/referrals/info');

      if (res.success) {
        setInfo(res.info);
        setReferralLink(res.referralLink);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки рефералов');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    hapticNotification('success');
    soundManager.playCoinTap();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    hapticImpact('medium');
    const shareText = encodeURIComponent('🪙 Играй со мной в кликер Токен! Получи приветственный бонус до 5.000 Токенов при старте 🚀');
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${shareText}`;
    window.open(url, '_blank');
  };

  const handleClaim = async () => {
    if (!info || info.unclaimedBalance <= 0 || claiming) return;

    try {
      setClaiming(true);
      setError(null);
      hapticImpact('heavy');

      const res = await apiRequest<{
        success: boolean;
        claimed: number;
        balance: number;
        info: ReferralsInfo;
      }>('/api/referrals/claim', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        setInfo(res.info);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 70,
          spread: 75,
          origin: { y: 0.6 },
          colors: ['#eab308', '#38bdf8', '#10b981', '#a855f7'],
        });
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка сбора реферальных');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-1.5">
                Рефералы 2.0 👥
              </h2>
              <p className="text-xs text-slate-400">Приглашай друзей и получай процент</p>
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
          {/* Safe Vault Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💰</span>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-indigo-300 font-bold">
                    Реферальный сейф
                  </div>
                  <div className="text-2xl font-black font-mono text-white">
                    +{formatTokens(info?.unclaimedBalance || 0)}{' '}
                    <span className="text-xs text-indigo-400">Т</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleClaim}
                disabled={claiming || (info?.unclaimedBalance || 0) <= 0}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-1"
              >
                <span>{claiming ? 'Сбор...' : 'Забрать'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
              <span>
                Друзей: <strong className="text-white font-mono">{info?.friendsCount || 0}</strong>
              </span>
              <span>
                Всего заработано: <strong className="text-emerald-400 font-mono">+{formatTokens(info?.totalEarned || 0)} Т</strong>
              </span>
            </div>
          </div>

          {/* Referral Rules Highlights */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
              <div className="text-emerald-400 font-bold flex items-center gap-1">
                <Gift className="w-3.5 h-3.5" />
                Бонус на старте
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                <strong>+1.000 Т</strong> обычному другу, <strong>+5.000 Т</strong> другу с Premium.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/60 border border-white/5 space-y-1">
              <div className="text-indigo-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                Пассивный %
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                <strong>10%</strong> от всех тапов и <strong>5%</strong> от побед друга в играх.
              </p>
            </div>
          </div>

          {/* Share & Copy Link */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">Ваша пригласительная ссылка:</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-xs font-mono text-slate-300 truncate">
                {referralLink || 'Загрузка...'}
              </div>

              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all flex items-center gap-1 shrink-0 text-xs font-bold"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Скопировано' : 'Копия'}</span>
              </button>
            </div>

            <button
              onClick={handleShare}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-sky-500/20 active:scale-95 transition-all mt-1"
            >
              <Share2 className="w-4 h-4" />
              <span>Поделиться в Telegram (+10% навсегда)</span>
            </button>
          </div>

          {/* Sub-tabs: Friends / Leaderboard */}
          <div className="space-y-2 pt-1">
            <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5">
              <button
                onClick={() => setActiveTab('friends')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'friends' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Мои друзья ({info?.friendsCount || 0})
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === 'leaderboard' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                Топ инвайтеров
              </button>
            </div>

            {/* Friends Tab */}
            {activeTab === 'friends' && (
              <div className="space-y-1.5">
                {!info?.friends || info.friends.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                    У вас пока нет приглашённых друзей. Отправьте ссылку выше!
                  </div>
                ) : (
                  info.friends.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center text-xs">
                          {f.first_name[0] || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-white">{f.first_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            @{f.username || `id${f.id}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-emerald-400 font-mono font-bold">
                          +{formatTokens(f.earnedTotal)} Т
                        </div>
                        <div className="text-[9px] text-slate-500">Принёс дохода</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Leaderboard Tab */}
            {activeTab === 'leaderboard' && (
              <div className="space-y-1.5">
                {!info?.topInviters || info.topInviters.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/10 text-center text-xs text-slate-500">
                    Рейтинг формируется...
                  </div>
                ) : (
                  info.topInviters.map((inv, index) => (
                    <div
                      key={inv.id}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        index === 0
                          ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                          : index === 1
                          ? 'bg-slate-800/80 border-slate-400/40 text-slate-200'
                          : index === 2
                          ? 'bg-orange-950/30 border-orange-500/40 text-orange-300'
                          : 'bg-slate-800/40 border-white/5 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-black text-sm w-4 text-center">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`}
                        </span>
                        <div>
                          <div className="font-bold">{inv.first_name}</div>
                          <div className="text-[10px] opacity-75">
                            {inv.friendsCount} друзей приглашено
                          </div>
                        </div>
                      </div>

                      <div className="font-mono font-bold text-emerald-400">
                        +{formatTokens(inv.totalEarned)} Т
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
