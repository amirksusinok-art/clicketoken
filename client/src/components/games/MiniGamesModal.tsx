import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Rocket,
  Plane,
  Sparkles,
  Binary,
  Layers,
  Swords,
  Star,
  User as UserIcon,
} from 'lucide-react';
import { CrashGame } from './CrashGame.js';
import { AirplaneGame } from './AirplaneGame.js';
import { RandomGame } from './RandomGame.js';
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

type GameType = 'crash' | 'plinko' | 'wheel_pvp' | 'airplane' | 'hilo' | 'random';
type FilterType = 'all' | 'popular' | 'fast';

interface GameItem {
  id: GameType;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  icon: any;
  gradient: string;
  category: ('all' | 'popular' | 'fast')[];
  renderIllustration: () => React.ReactNode;
}

const GAMES: GameItem[] = [
  {
    id: 'crash',
    title: 'Crash',
    subtitle: '• Мультиплеер • до x1000',
    badge: '• HOT',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: Rocket,
    gradient: 'from-amber-950/60 via-slate-900 to-red-950/50',
    category: ['all', 'popular', 'fast'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
        {/* Trajectory curve */}
        <svg viewBox="0 0 120 60" className="absolute inset-0 w-full h-full opacity-60 pointer-events-none">
          <defs>
            <linearGradient id="crashGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d="M 10 50 Q 55 48 95 18" fill="none" stroke="url(#crashGrad)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="95" cy="18" r="3.5" fill="#f59e0b" className="animate-pulse" />
        </svg>
        {/* Glowing Rocket */}
        <div className="relative z-10 translate-x-3 -translate-y-1 transform rotate-[-35deg] drop-shadow-[0_0_12px_rgba(245,158,11,0.6)]">
          <Rocket className="w-8 h-8 text-amber-400 fill-amber-500/30" />
        </div>
      </div>
    ),
  },
  {
    id: 'plinko',
    title: 'Plinko',
    subtitle: '• Падение шара • до x1000',
    badge: '• NEW',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    icon: Layers,
    gradient: 'from-teal-950/70 via-slate-900 to-emerald-950/50',
    category: ['all', 'popular'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
        {/* Plinko Pegs Pyramid & falling balls */}
        <svg viewBox="0 0 100 60" className="w-24 h-14 opacity-80 pointer-events-none">
          {/* Row 1 */}
          <circle cx="50" cy="12" r="2" fill="#34d399" />
          {/* Row 2 */}
          <circle cx="40" cy="24" r="2" fill="#34d399" />
          <circle cx="60" cy="24" r="2" fill="#34d399" />
          {/* Row 3 */}
          <circle cx="30" cy="36" r="2" fill="#34d399" />
          <circle cx="50" cy="36" r="2" fill="#34d399" />
          <circle cx="70" cy="36" r="2" fill="#34d399" />
          {/* Row 4 */}
          <circle cx="20" cy="48" r="2" fill="#34d399" />
          <circle cx="40" cy="48" r="2" fill="#34d399" />
          <circle cx="60" cy="48" r="2" fill="#34d399" />
          <circle cx="80" cy="48" r="2" fill="#34d399" />
          {/* Falling neon ball */}
          <circle cx="45" cy="28" r="3.5" fill="#10b981" className="animate-bounce" filter="drop-shadow(0 0 6px #10b981)" />
        </svg>
      </div>
    ),
  },
  {
    id: 'wheel_pvp',
    title: 'Колесо 1v1',
    subtitle: '• Дуэль игроков • 1.8x банк',
    badge: '• 1v1 PVP',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    icon: Swords,
    gradient: 'from-purple-950/80 via-slate-900 to-indigo-950/60',
    category: ['all', 'popular', 'fast'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
        {/* 3D Wheel Mini Graphic */}
        <div className="relative w-14 h-14 rounded-full border-2 border-amber-400/80 bg-slate-900/90 shadow-[0_0_15px_rgba(168,85,247,0.4)] flex items-center justify-center">
          <svg viewBox="0 0 40 40" className="w-full h-full animate-spin [animation-duration:12s]">
            <circle cx="20" cy="20" r="18" fill="none" stroke="#6366f1" strokeWidth="2" strokeDasharray="6 4" />
            <path d="M 20 2 L 20 38 M 2 20 L 38 20" stroke="#a855f7" strokeWidth="1.5" strokeOpacity="0.8" />
            <path d="M 7 7 L 33 33 M 7 33 L 33 7" stroke="#eab308" strokeWidth="1" strokeOpacity="0.7" />
          </svg>
          <div className="absolute w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[8px] font-black text-slate-950 shadow-md">
            VS
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'airplane',
    title: 'Самолётик',
    subtitle: '• Кольца и ракеты • x1.5 / ÷1.5',
    badge: '• FAIR',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    icon: Plane,
    gradient: 'from-blue-950/70 via-slate-900 to-sky-950/50',
    category: ['all', 'fast'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center overflow-hidden">
        {/* Jet soaring through laser rings */}
        <svg viewBox="0 0 100 50" className="w-24 h-12 opacity-80 pointer-events-none">
          {/* Target Ring */}
          <ellipse cx="65" cy="22" rx="6" ry="14" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 2" />
          {/* Jet trail */}
          <path d="M 15 36 Q 40 32 60 22" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="4 2" />
        </svg>
        <div className="absolute z-10 translate-x-2 -translate-y-1 transform rotate-[-20deg] drop-shadow-[0_0_10px_rgba(56,189,248,0.6)]">
          <Plane className="w-7 h-7 text-sky-400 fill-sky-500/20" />
        </div>
      </div>
    ),
  },
  {
    id: 'hilo',
    title: 'Больше / Меньше',
    subtitle: '• 0–999999 • 1% ком.',
    badge: '• FAIR',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    icon: Binary,
    gradient: 'from-indigo-950/70 via-slate-900 to-blue-950/50',
    category: ['all', 'fast'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center gap-2 overflow-hidden">
        {/* High/Low Number Cards */}
        <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-mono font-black text-xs shadow-[0_0_8px_rgba(16,185,129,0.3)]">
          ▲ &gt;50
        </div>
        <div className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/40 text-rose-400 font-mono font-black text-xs shadow-[0_0_8px_rgba(244,63,94,0.3)]">
          ▼ &lt;50
        </div>
      </div>
    ),
  },
  {
    id: 'random',
    title: 'Random',
    subtitle: '• Колесо шансов • до x5',
    badge: '• FAIR',
    badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    icon: Sparkles,
    gradient: 'from-fuchsia-950/70 via-slate-900 to-indigo-950/50',
    category: ['all', 'fast'],
    renderIllustration: () => (
      <div className="relative w-full h-16 flex items-center justify-center gap-1.5 overflow-hidden">
        {/* Multiplier tags & sparkles */}
        <div className="px-1.5 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-purple-300 font-mono font-bold text-[10px]">
          ×1.5
        </div>
        <div className="px-2 py-1 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 font-mono font-black text-xs shadow-[0_0_10px_rgba(234,179,8,0.4)]">
          ★ ×5.0
        </div>
        <div className="px-1.5 py-0.5 rounded-md bg-pink-500/20 border border-pink-500/40 text-pink-300 font-mono font-bold text-[10px]">
          ×2.0
        </div>
      </div>
    ),
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

  // Load favorites from server
  useEffect(() => {
    if (isOpen) {
      apiRequest<{ success: boolean; favorites: string[] }>('/api/games/favorites')
        .then((res) => {
          if (res.success && res.favorites) {
            setFavorites(res.favorites);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleToggleFavorite = async (gameId: string) => {
    // Optimistic toggle
    setFavorites((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
    try {
      const res = await apiRequest<{ success: boolean; favorites: string[] }>('/api/games/favorites/toggle', {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      });
      if (res.success && res.favorites) {
        setFavorites(res.favorites);
      }
    } catch {}
  };

  if (!isOpen || !profile) return null;

  const filteredGames = GAMES.filter((g) => g.category.includes(filter));
  const favoriteGamesList = GAMES.filter((g) => favorites.includes(g.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0d121f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh]">
        {/* If a game is selected, render the game screen */}
        {activeGame ? (
          <div className="p-4 overflow-y-auto flex-1 flex flex-col justify-between">
            {activeGame === 'crash' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
                    CRASH
                  </h1>
                  <div className="w-8" />
                </div>
                <CrashGame
                  balance={balance}
                  userId={profile.id}
                  onBalanceUpdate={onBalanceUpdate}
                />
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
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
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

            {activeGame === 'airplane' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
                    САМОЛЁТИК
                  </h1>
                  <div className="w-8" />
                </div>
                <AirplaneGame
                  balance={balance}
                  onBalanceUpdate={onBalanceUpdate}
                  planeSkin={profile?.active_plane_skin}
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

            {activeGame === 'random' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <button
                    onClick={() => setActiveGame(null)}
                    className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h1 className="text-base font-black tracking-widest text-white uppercase font-mono">
                    RANDOM
                  </h1>
                  <div className="w-8" />
                </div>
                <RandomGame balance={balance} onBalanceUpdate={onBalanceUpdate} />
              </div>
            )}
          </div>
        ) : (
          /* ИГРОВОЙ ЗАЛ (Matching Screenshot 4) */
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
                        className={`shrink-0 w-36 rounded-2xl bg-gradient-to-br ${game.gradient} border border-amber-500/40 p-3 flex flex-col justify-between h-32 hover:border-amber-400 transition cursor-pointer shadow-lg active:scale-95 group`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ★ ИЗБРАННОЕ
                          </span>
                          <game.icon className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-white group-hover:text-amber-300 transition">{game.title}</h5>
                          <p className="text-[9px] text-slate-400 truncate">{game.subtitle}</p>
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

              {/* 2-Column Games Grid with Visual Icons / Illustrations & Star Toggles */}
              <div className="grid grid-cols-2 gap-3 pb-2">
                {filteredGames.map((game) => {
                  const Icon = game.icon;
                  const isFav = favorites.includes(game.id);
                  return (
                    <div
                      key={game.id}
                      onClick={() => setActiveGame(game.id)}
                      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${game.gradient} border ${
                        isFav ? 'border-amber-500/30' : 'border-white/10'
                      } p-3.5 flex flex-col justify-between h-44 hover:border-sky-500/40 transition-all transform active:scale-95 cursor-pointer shadow-lg group`}
                    >
                      {/* Badge in top-left, star toggle + mini icon in top-right */}
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md border ${game.badgeColor}`}
                        >
                          {game.badge}
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Star Toggle Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(game.id);
                            }}
                            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition cursor-pointer"
                            title={isFav ? 'Убрать из избранного' : 'Добавить в избранное'}
                          >
                            <Star
                              className={`w-4 h-4 transition ${
                                isFav
                                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.7)]'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            />
                          </button>

                          <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-white/10 transition">
                            <Icon className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* Center Visual Artwork / Graphic */}
                      <div className="my-auto py-1">
                        {game.renderIllustration()}
                      </div>

                      {/* Game Title & Subtitle in bottom */}
                      <div className="space-y-0.5 pt-1">
                        <h4 className="text-sm font-black text-white group-hover:text-sky-300 transition">
                          {game.title}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {game.subtitle}
                        </p>
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
