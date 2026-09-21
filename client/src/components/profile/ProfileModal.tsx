import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Users,
  Star,
  Send,
  Swords,
  Shield,
  Eye,
  EyeOff,
  UserPlus,
  UserCheck,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { UserProfile } from '../../hooks/useClicker.js';
import { AnimatedNumber } from '../AnimatedNumber.js';
import { formatTokens } from '../../lib/formatters.js';
import { apiRequest } from '../../lib/api.js';
import { useTelegram } from '../../hooks/useTelegram.js';
import { soundManager } from '../../lib/sound.js';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  balance: number;
  targetUserId?: number | null; // If set, viewing another player
  onOpenFriends?: () => void;
  onOpenFavorites?: () => void;
  onOpenTransfers?: (prefillUsername?: string) => void;
  onOpenPvpWithFriend?: (friendUserId: number, friendName: string) => void;
}

interface PublicUserData {
  id: number;
  username: string | null;
  first_name: string;
  earn_per_click: number;
  balance: number | null;
  isBalanceHidden: boolean;
  isFriend: boolean;
  stats: {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
  };
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  balance,
  targetUserId,
  onOpenFriends,
  onOpenFavorites,
  onOpenTransfers,
  onOpenPvpWithFriend,
}) => {
  const [publicUser, setPublicUser] = useState<PublicUserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(soundManager.isSoundEnabled());

  const { hapticImpact, hapticNotification } = useTelegram();

  const handleToggleSound = () => {
    const next = soundManager.toggleSound();
    setSoundEnabled(next);
    hapticImpact('light');
  };

  const isSelf = !targetUserId || (currentUser && targetUserId === currentUser.id);

  // Sync privacy state for self
  useEffect(() => {
    if (currentUser) {
      setHideBalance(!!currentUser.hide_public_balance);
    }
  }, [currentUser]);

  // Load public profile if viewing another player
  useEffect(() => {
    if (!isOpen) return;

    if (!isSelf && targetUserId) {
      setLoading(true);
      apiRequest<{ success: boolean; user: PublicUserData }>(
        `/api/user/public-profile/${targetUserId}`
      )
        .then((res) => {
          if (res.success && res.user) {
            setPublicUser(res.user);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setPublicUser(null);
    }
  }, [isOpen, targetUserId, isSelf]);

  if (!isOpen || !currentUser) return null;

  // Toggle privacy
  const handleTogglePrivacy = async () => {
    const nextVal = !hideBalance;
    setHideBalance(nextVal);
    hapticImpact('light');
    try {
      await apiRequest('/api/user/privacy', {
        method: 'POST',
        body: JSON.stringify({ hideBalance: nextVal }),
      });
      if (currentUser) {
        currentUser.hide_public_balance = nextVal ? 1 : 0;
      }
    } catch {}
  };

  // Toggle friend status for another player
  const handleToggleFriend = async () => {
    if (!publicUser) return;
    hapticImpact('medium');
    try {
      if (publicUser.isFriend) {
        await apiRequest('/api/friends/remove', {
          method: 'POST',
          body: JSON.stringify({ friendUserId: publicUser.id }),
        });
        setPublicUser((prev) => (prev ? { ...prev, isFriend: false } : null));
      } else {
        await apiRequest('/api/friends/add', {
          method: 'POST',
          body: JSON.stringify({ friendUserId: publicUser.id }),
        });
        setPublicUser((prev) => (prev ? { ...prev, isFriend: true } : null));
        hapticNotification('success');
      }
    } catch {}
  };

  // Profile data to render
  const profileName = isSelf
    ? currentUser.first_name || currentUser.username || 'Игрок'
    : publicUser?.first_name || publicUser?.username || 'Игрок';

  const profileUsername = isSelf
    ? currentUser.username
    : publicUser?.username;

  const profileIncome = isSelf
    ? currentUser.earn_per_click
    : publicUser?.earn_per_click || 0.001;

  const avatarInitial = profileName[0]?.toUpperCase() || 'U';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#0d121f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-[#121827]">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-sm font-black tracking-wider text-white uppercase font-mono">
            {isSelf ? 'МОЙ ПРОФИЛЬ' : 'ПРОФИЛЬ ИГРОКА'}
          </h2>

          <div className="w-8" />
        </div>

        {/* Scrollable Body */}
        {loading && !isSelf ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-mono">Загрузка профиля...</span>
          </div>
        ) : (
          <div className="p-5 overflow-y-auto space-y-5">
            {/* Avatar & User Details */}
            <div className="flex flex-col items-center text-center space-y-2.5">
              {/* Glowing Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-[3px] shadow-xl shadow-amber-500/20">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-amber-300 font-black text-2xl">
                    {avatarInitial}
                  </div>
                </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0d121f] flex items-center justify-center text-white text-[10px] font-black">
                ✓
              </div>
            </div>

            {/* Names */}
            <div>
              <h3 className="text-lg font-black text-white leading-tight">
                {profileName}
              </h3>
              {profileUsername && (
                <span className="text-xs font-mono font-bold text-sky-400">
                  @{profileUsername}
                </span>
              )}
            </div>

            {/* Tokens Balance Badge */}
            <div className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-white/10 shadow-inner flex flex-col items-center justify-center space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                БАЛАНС ТОКЕНОВ
              </span>
              <div className="flex items-center gap-1.5 font-mono text-2xl font-black text-white">
                {isSelf ? (
                  <>
                    <AnimatedNumber value={balance} />
                    <span className="text-amber-400 text-xl">🪙</span>
                  </>
                ) : publicUser?.isBalanceHidden ? (
                  <span className="text-slate-400 text-base flex items-center gap-1">
                    <Shield className="w-4 h-4 text-slate-500" /> Скрыт приватностью
                  </span>
                ) : (
                  <>
                    <span>{formatTokens(publicUser?.balance ?? 0)}</span>
                    <span className="text-amber-400 text-xl">🪙</span>
                  </>
                )}
              </div>

              {/* Earn Per Click */}
              <div className="text-[11px] font-mono text-emerald-400 font-bold flex items-center gap-1 pt-0.5">
                <span>⚡ +{formatTokens(profileIncome, 3)}</span>
                <span className="text-slate-500 font-sans">/ клик</span>
              </div>
            </div>
          </div>

          {/* If viewing another player: Game Stats */}
          {!isSelf && publicUser && (
            <div className="space-y-3">
              <div className="text-xs uppercase font-black tracking-wider text-slate-300 flex items-center gap-1.5 px-1">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Игровая статистика
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="p-2.5 bg-slate-900/70 border border-white/5 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Игр</span>
                  <strong className="text-white text-sm">{publicUser.stats.totalMatches}</strong>
                </div>
                <div className="p-2.5 bg-slate-900/70 border border-white/5 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Побед</span>
                  <strong className="text-emerald-400 text-sm">{publicUser.stats.wins}</strong>
                </div>
                <div className="p-2.5 bg-slate-900/70 border border-white/5 rounded-xl">
                  <span className="text-[10px] text-slate-400 font-sans uppercase block">Винрейт</span>
                  <strong className="text-sky-400 text-sm">{publicUser.stats.winRate}%</strong>
                </div>
              </div>

              {/* Quick Actions for Other Player */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenTransfers && publicUser.username) {
                      onOpenTransfers(publicUser.username);
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
                >
                  <Send className="w-4 h-4" />
                  <span>Перевести токены</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    if (onOpenPvpWithFriend) {
                      onOpenPvpWithFriend(publicUser.id, publicUser.username || publicUser.first_name);
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
                >
                  <Swords className="w-4 h-4" />
                  <span>Пригласить в PvP (Колесо 1v1)</span>
                </button>

                <button
                  onClick={handleToggleFriend}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase transition cursor-pointer flex items-center justify-center gap-2 border ${
                    publicUser.isFriend
                      ? 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                  }`}
                >
                  {publicUser.isFriend ? (
                    <>
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span>Удалить из друзей</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Добавить в друзья</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* If viewing Self: Privacy Toggle & Navigation Buttons */}
          {isSelf && (
            <div className="space-y-3.5">
              {/* Privacy Setting Card */}
              <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                    {hideBalance ? <EyeOff className="w-4 h-4 text-rose-400" /> : <Eye className="w-4 h-4 text-emerald-400" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight">
                      Скрывать точный баланс
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Другие увидят статус «Скрыт»
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleTogglePrivacy}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    hideBalance ? 'bg-sky-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      hideBalance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Sound Effects (SFX) Setting Card */}
              <div className="p-3 bg-slate-900/60 border border-white/10 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                    {soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white leading-tight">
                      Звуковые эффекты (SFX)
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Клики, реактивные свисты и фанфары
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleToggleSound}
                  className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                    soundEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Navigation Actions */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => {
                    onClose();
                    if (onOpenFriends) onOpenFriends();
                  }}
                  className="py-3 px-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-md group"
                >
                  <Users className="w-4 h-4 text-sky-400 group-hover:scale-110 transition" />
                  <span>Друзья</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    if (onOpenFavorites) onOpenFavorites();
                  }}
                  className="py-3 px-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-white/10 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-md group"
                >
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400/20 group-hover:scale-110 transition" />
                  <span>Избранное</span>
                </button>
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};
