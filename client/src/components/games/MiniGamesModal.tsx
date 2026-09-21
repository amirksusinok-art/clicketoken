import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Rocket,
  Trophy,
  Layers,
  Swords,
  Star,
  Sparkles,
  Coins,
  Ticket,
  User as UserIcon,
} from 'lucide-react';
import { CrashGame } from './CrashGame.js';
import { PenaltyGame } from './PenaltyGame.js';
import { CoinFlipGame } from './CoinFlipGame.js';
import { ScratchGame } from './ScratchGame.js';
import { HiLoGame } from './HiLoGame.js';
import { PlinkoGame } from './PlinkoGame.js';
import { WheelPvpGame } from './WheelPvpGame.js';
import type { UserProfile } from '../../hooks/useClicker.js';
import { formatTokens } from '../../lib/formatters.js';
import { apiRequest } from '../../lib/api.js';

interface MiniGamesModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  balance: number;
  onBalanceUpdate: (newBalance: number) => void;
}

type GameType = 'crash' | 'penalty' | 'coinflip' | 'scratch' | 'plinko' | 'wheel_pvp' | 'hilo';
type FilterType = 'all' | 'popular' | 'fast';

interface GameItem {
  id: GameType;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: any;
  coverImage: string;
  gradient: string;
  category: ('all' | 'popular' | 'fast')[];
}

const GAMES: GameItem[] = [
  {
    id: 'penalty',
    title: 'Пенальти',
    subtitle: '• 5 секторов • до ×30.72',
    badge: '• NEW',
    badgeColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40',
    icon: Trophy,
    coverImage: '/games/cover_penalty.jpg',
    gradient: 'from-emerald-950/80 via-slate-900 to-teal-950/60',
    category: ['all', 'popular', 'fast'],
  },
  {
    id: 'coinflip',
    title: 'CoinFlip',
    subtitle: '• Орёл / Решка • ×1.96',
    badge: '• NEW',
    badgeColor: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
    icon: Coins,
    coverImage: '/games/cover_random.jpg',
    gradient: 'from-amber-950/80 via-slate-900 to-yellow-950/60',
    category: ['all', 'popular', 'fast'],
  },
  {
    id: 'crash',
    title: 'Crash',
    subtitle: '• Мультиплеер • до ×1000',
    badge: '• TOP',
    badgeColor: 'text-rose-400 bg-rose-500/20 border-rose-500/40',
    icon: Rocket,
    coverImage: '/games/cover_crash.jpg',
    gradient: 'from-amber-950/60 via-slate-900 to-red-950/50',
    category: ['all', 'popular', 'fast'],
  },
  {
    id: 'scratch',
    title: 'Скретч-карты',
    subtitle: '• Сотри и выиграй • до ×500',
    badge: '• HOT',
    badgeColor: 'text-amber-400 bg-amber-500/20 border-amber-500/40',
    icon: Ticket,
    coverImage: '/games/cover_cases.jpg',
    gradient: 'from-amber-950/80 via-slate-900 to-yellow-950/60',
    category: ['all', 'popular', 'fast'],
  },
  {
    id: 'plinko',
    title: 'Plinko',
    subtitle: '• Падение шара • до ×1000',
    badge: '• HIT',
    badgeColor: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/40',
    icon: Layers,
    coverImage: '/games/cover_plinko.jpg',
    gradient: 'from-teal-950/70 via-slate-900 to-emerald-950/50',
    category: ['all', 'popular'],
  },
  {
    id: 'wheel_pvp',
    title: 'Колесо 1v1',
    subtitle: '• Дуэль игроков • 1.8x банк',
    badge: '• PVP',
    badgeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/40',
    icon: Swords,
    coverImage: '/games/cover_wheel.jpg',
    gradient: 'from-purple-950/80 via-slate-900 to-indigo-950/60',
    category: ['all', 'popular', 'fast'],
  },
  {
    id: 'hilo',
    title: 'Больше / Меньше',
    subtitle: '• Карты Hi-Lo • до ×12.8',
    badge: '• CLASSIC',
    badgeColor: 'text-indigo-400 bg-indigo-500/20 border-indigo-500/40',
    icon: Sparkles,
    coverImage: '/games/cover_hilo.jpg',
    gradient: 'from-indigo-950/70 via-slate-900 to-violet-950/50',
    category: ['all', 'fast'],
  },
];

export const MiniGamesModal: React.FC<MiniGamesModalProps> = ({
  isOpen,
  onClose,
  profile,
  balance,
  onBalanceUpdate,
}) => {
  const [activeGame, setActiveGame] = useState<GameType | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      apiRequest<{ success: boolean; favorites: string[] }>('/api/games/favorites')
        .then((res) => {
          if (res.success) setFavorites(res.favorites || []);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  const handleToggleFavorite = async (gameId: string) => {
    try {
      const res = await apiRequest<{ success: boolean; favorites: string[] }>('/api/games/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      });
      if (res.success) {
        setFavorites(res.favorites);
      }
    } catch (e) {
      setFavorites((prev) =>
        prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
      );
    }
  };

  const filteredGames = GAMES.filter((g) => {
    if (filter === 'all') return true;
    return g.category.includes(filter);
  });

  const favoriteGamesList = GAMES.filter((g) => favorites.includes(g.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d121f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh]">
        {/* If a game is selected, render the game screen */}
        {activeGame ? (
          <div className="p-4 overflow-y-auto flex-1 flex flex-col justify-between">
            {activeGame === 'penalty' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-emerald-400" />
                    ПЕНАЛЬТИ
                  </h1>
                  <div className="w-8" />
                </div>
                <PenaltyGame balance={balance} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}

            {activeGame === 'coinflip' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-amber-400" />
                    COINFLIP
                  </h1>
                  <div className="w-8" />
                </div>
                <CoinFlipGame balance={balance} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}

            {activeGame === 'crash' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono flex items-center gap-1.5">
                    <Rocket className="w-4 h-4 text-rose-400" />
                    CRASH
                  </h1>
                  <div className="w-8" />
                </div>
                <CrashGame balance={balance} userId={profile.id} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}

            {activeGame === 'plinko' && (
              <PlinkoGame
                balance={balance}
                username={profile.first_name || profile.username || 'Игрок'}
                onBalanceUpdate={onBalanceUpdate}
                onBack={() => setActiveGame(null)}
              />
            )}

            {activeGame === 'wheel_pvp' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono flex items-center gap-1.5">
                    <Swords className="w-4 h-4 text-purple-400" />
                    КОЛЕСО 1V1
                  </h1>
                  <div className="w-8" />
                </div>
                <WheelPvpGame
                  balance={balance}
                  username={profile.first_name || profile.username || 'Игрок'}
                  onBalanceUpdate={onBalanceUpdate}
                  onBack={() => setActiveGame(null)}
                />
              </div>
            )}

            {activeGame === 'hilo' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
                    БОЛЬШЕ / МЕНЬШЕ
                  </h1>
                  <div className="w-8" />
                </div>
                <HiLoGame balance={balance} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}

            {activeGame === 'scratch' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-amber-400" />
                    СКРЕТЧ-КАРТЫ
                  </h1>
                  <div className="w-8" />
                </div>
                <ScratchGame balance={balance} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}
          </div>
        ) : (
          /* ИГРОВОЙ ЗАЛ - Каталог игр с кинематографичными обложками */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header: Back Button + Title */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/5 bg-[#121827]">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h1 className="text-base font-black tracking-wider text-white uppercase font-sans">
                ИГРОВОЙ ЗАЛ
              </h1>

              <div className="w-8" />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Category Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                    filter === 'all'
                      ? 'bg-slate-800 text-white border border-white/20 shadow-md'
                      : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white'
                  }`}
                >
                  Все игры
                </button>
                <button
                  onClick={() => setFilter('popular')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                    filter === 'popular'
                      ? 'bg-slate-800 text-white border border-white/20 shadow-md'
                      : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white'
                  }`}
                >
                  Популярные
                </button>
                <button
                  onClick={() => setFilter('fast')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer ${
                    filter === 'fast'
                      ? 'bg-slate-800 text-white border border-white/20 shadow-md'
                      : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:text-white'
                  }`}
                >
                  Быстрые
                </button>
              </div>

              {/* Pinned Favorites Section */}
              {favoriteGamesList.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider font-black text-amber-400 px-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    ИЗБРАННЫЕ ИГРЫ ({favoriteGamesList.length})
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
                    {favoriteGamesList.map((game) => (
                      <div
                        key={`fav-${game.id}`}
                        onClick={() => setActiveGame(game.id)}
                        className="relative shrink-0 w-36 h-36 rounded-2xl overflow-hidden border border-amber-500/50 p-2.5 flex flex-col justify-between hover:border-amber-400 transition cursor-pointer shadow-lg active:scale-95 group"
                      >
                        <img
                          src={game.coverImage}
                          alt={game.title}
                          className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-black/40 to-black/30 pointer-events-none" />

                        <div className="relative z-10 flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/80 text-black">
                            ★
                          </span>
                          <game.icon className="w-4 h-4 text-amber-400 drop-shadow-md" />
                        </div>
                        <div className="relative z-10">
                          <h5 className="text-xs font-black text-white group-hover:text-amber-300 transition">{game.title}</h5>
                          <p className="text-[9px] text-slate-300 truncate">{game.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section Header */}
              <div className="text-xs uppercase tracking-wider font-black text-slate-300 pt-1">
                КАТАЛОГ ИГР ({filteredGames.length})
              </div>

              {/* 2-Column Games Grid with Cinematic AI Covers */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                {filteredGames.map((game) => {
                  const Icon = game.icon;
                  const isFav = favorites.includes(game.id);

                  return (
                    <div
                      key={game.id}
                      onClick={() => setActiveGame(game.id)}
                      className={`relative overflow-hidden rounded-2xl border ${
                        isFav ? 'border-amber-500/50 shadow-amber-500/10' : 'border-white/10'
                      } flex flex-col justify-between h-48 hover:border-sky-500/60 transition-all transform active:scale-95 cursor-pointer shadow-xl group`}
                    >
                      {/* Cinematic AI Cover Image as Background with Zoom & Glow */}
                      <img
                        src={game.coverImage}
                        alt={game.title}
                        className="absolute inset-0 w-full h-full object-cover object-center group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-black/30 pointer-events-none" />

                      {/* Top Row: Badge & Star Toggle */}
                      <div className="relative z-10 p-3 flex items-center justify-between">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border backdrop-blur-md ${game.badgeColor}`}>
                          {game.badge}
                        </span>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(game.id);
                          }}
                          className="w-7 h-7 rounded-lg bg-black/60 backdrop-blur-md hover:bg-black/80 flex items-center justify-center transition cursor-pointer"
                          title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
                        >
                          <Star
                            className={`w-4 h-4 transition ${
                              isFav
                                ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Bottom Row: Title, Subtitle, and Arrow */}
                      <div className="relative z-10 p-3 bg-gradient-to-t from-black via-black/80 to-transparent">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 pr-1">
                            <h4 className="text-sm font-black text-white group-hover:text-sky-300 transition flex items-center gap-1.5 truncate">
                              <Icon className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              <span className="truncate">{game.title}</span>
                            </h4>
                            <p className="text-[10px] text-slate-300 font-medium truncate">
                              {game.subtitle}
                            </p>
                          </div>
                          <div className="w-6 h-6 rounded-full bg-white/10 group-hover:bg-sky-500 group-hover:text-black text-white flex items-center justify-center transition shrink-0">
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Persistent Bottom User Strip */}
            <div className="flex items-center justify-between p-3.5 border-t border-white/5 bg-[#121827] px-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-xs ring-1 ring-white/20">
                  {profile.first_name ? profile.first_name[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-white leading-tight">
                    {profile.first_name || profile.username || 'Игрок'}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400">БАЛАНС</div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-sm font-black text-white">
                <span>{formatTokens(balance)}</span>
                <span className="text-amber-400 text-base">🪙</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
