import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Users,
  Search,
  UserPlus,
  UserCheck,
  Send,
  Swords,
  User,
  Share2,
  Check,
} from 'lucide-react';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface FriendItem {
  id: number;
  username: string | null;
  first_name: string;
  balance: number;
  earn_per_click: number;
  hide_public_balance: number;
  added_at: number;
}

interface FriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewProfile: (userId: number) => void;
  onOpenTransfers: (prefillUsername?: string) => void;
  onOpenPvpWithFriend: (friendUserId: number, friendName: string) => void;
}

export const FriendsModal: React.FC<FriendsModalProps> = ({
  isOpen,
  onClose,
  onViewProfile,
  onOpenTransfers,
  onOpenPvpWithFriend,
}) => {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FriendItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const { hapticImpact, hapticNotification, openTelegramLink } = useTelegram();

  // Load friends on open
  const loadFriends = async () => {
    try {
      const res = await apiRequest<{ success: boolean; friends: FriendItem[] }>('/api/user/friends');
      if (res.success && res.friends) {
        setFriends(res.friends);
      }
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Handle Search input
  useEffect(() => {
    const clean = searchQuery.trim().replace(/^@/, '');
    if (!clean) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await apiRequest<{ success: boolean; results: FriendItem[] }>(
          `/api/user/friends/search?query=${encodeURIComponent(clean)}`
        );
        if (res.success && res.results) {
          setSearchResults(res.results);
        }
      } catch {}
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  if (!isOpen) return null;

  // Add friend
  const handleAddFriend = async (friendId: number) => {
    hapticImpact('medium');
    try {
      await apiRequest('/api/user/friends/add', {
        method: 'POST',
        body: JSON.stringify({ friendUserId: friendId }),
      });
      hapticNotification('success');
      loadFriends();
    } catch {}
  };

  // Remove friend
  const handleRemoveFriend = async (friendId: number) => {
    hapticImpact('light');
    try {
      await apiRequest('/api/user/friends/remove', {
        method: 'POST',
        body: JSON.stringify({ friendUserId: friendId }),
      });
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch {}
  };

  // Share Telegram invite
  const handleShareInvite = () => {
    hapticImpact('light');
    const shareText = encodeURIComponent('🎮 Заходи играть со мной в Telegram Mini App Токен-кликер и PvP-колесо!');
    const shareUrl = `https://t.me/share/url?url=https://t.me&text=${shareText}`;
    openTelegramLink(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const friendIdsSet = new Set(friends.map((f) => f.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d121f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-[#121827]">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <h2 className="text-sm font-black tracking-wider text-white uppercase font-mono flex items-center gap-1.5">
            <Users className="w-4 h-4 text-sky-400" />
            ДРУЗЬЯ
          </h2>

          <div className="w-8" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Search Input Bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Найти по @username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 font-mono font-medium focus:outline-none focus:border-sky-500 transition"
            />
          </div>

          {/* Search Results Section */}
          {searchQuery.trim() && (
            <div className="space-y-2">
              <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">
                РЕЗУЛЬТАТЫ ПОИСКА {isSearching && '...'}
              </div>

              {searchResults.length === 0 && !isSearching ? (
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 text-center text-xs text-slate-500">
                  Пользователь не найден
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => {
                    const isAlreadyFriend = friendIdsSet.has(user.id);
                    return (
                      <div
                        key={user.id}
                        className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-md"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                            {user.first_name[0]?.toUpperCase() || <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white leading-tight">
                              {user.first_name}
                            </div>
                            {user.username && (
                              <div className="text-[10px] font-mono text-sky-400">
                                @{user.username}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              onClose();
                              onViewProfile(user.id);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold uppercase transition cursor-pointer"
                          >
                            Профиль
                          </button>

                          <button
                            onClick={() => {
                              onClose();
                              onOpenTransfers(user.username || undefined);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 text-[10px] font-bold uppercase transition cursor-pointer"
                          >
                            Перевести
                          </button>

                          <button
                            onClick={() => (isAlreadyFriend ? handleRemoveFriend(user.id) : handleAddFriend(user.id))}
                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                              isAlreadyFriend
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                            }`}
                          >
                            {isAlreadyFriend ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Friends List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                ВАШИ ДРУЗЬЯ ({friends.length})
              </span>
              <button
                onClick={handleShareInvite}
                className="text-[10px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer transition"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Share2 className="w-3 h-3" />}
                <span>Пригласить</span>
              </button>
            </div>

            {friends.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-white/5 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-white/5 mx-auto flex items-center justify-center text-slate-400">
                  <Users className="w-6 h-6" />
                </div>
                <div className="text-xs font-bold text-white">Список друзей пуст</div>
                <p className="text-[11px] text-slate-400">
                  Найдите пользователей по @username или отправьте приглашение
                </p>
                <button
                  onClick={handleShareInvite}
                  className="mt-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                >
                  Пригласить друга в Telegram
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map((friend) => {
                  const isHidden = !!friend.hide_public_balance;
                  return (
                    <div
                      key={friend.id}
                      className="bg-slate-900/80 border border-white/10 rounded-2xl p-3 flex flex-col gap-2.5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-inner">
                            {friend.first_name[0]?.toUpperCase() || <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-black text-white leading-tight">
                              {friend.first_name}
                            </div>
                            {friend.username && (
                              <div className="text-[10px] font-mono text-sky-400">
                                @{friend.username}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Balance display */}
                        <div className="text-right font-mono">
                          <div className="text-xs font-black text-white">
                            {isHidden ? '***' : formatTokens(friend.balance)} 🪙
                          </div>
                          <div className="text-[9px] text-emerald-400">
                            +{formatTokens(friend.earn_per_click, 3)}/клик
                          </div>
                        </div>
                      </div>

                      {/* Quick Actions Row */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/5">
                        <button
                          onClick={() => {
                            onClose();
                            onViewProfile(friend.id);
                          }}
                          className="py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <User className="w-3 h-3" />
                          <span>Профиль</span>
                        </button>

                        <button
                          onClick={() => {
                            onClose();
                            onOpenTransfers(friend.username || undefined);
                          }}
                          className="py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Send className="w-3 h-3" />
                          <span>Перевод</span>
                        </button>

                        <button
                          onClick={() => {
                            onClose();
                            onOpenPvpWithFriend(friend.id, friend.username || friend.first_name);
                          }}
                          className="py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer flex items-center justify-center gap-1"
                        >
                          <Swords className="w-3 h-3 text-purple-400" />
                          <span>PvP</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
