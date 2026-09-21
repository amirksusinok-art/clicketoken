import React, { useState } from 'react';
import { ShieldCheck, User as UserIcon, Crown, Volume2, VolumeX } from 'lucide-react';
import type { UserProfile } from '../hooks/useClicker.js';
import { soundManager } from '../lib/sound.js';

interface HeaderProps {
  profile: UserProfile | null;
  onOpenProvablyFair: () => void;
  onOpenProfile?: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenProvablyFair,
  onOpenProfile,
  onOpenAdmin,
}) => {
  const [musicOn, setMusicOn] = useState(() => {
    try {
      return localStorage.getItem('clicketoken_bgm_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMusic = () => {
    const next = soundManager.toggleBgm();
    setMusicOn(next);
  };

  const isAdmin = profile?.id === 5394575689 || profile?.is_admin;

  return (
    <header className="w-full flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#090c14]/80 backdrop-blur-md sticky top-0 z-40">
      {/* User Info - Clickable for Profile */}
      <button
        onClick={onOpenProfile}
        className="flex items-center gap-2.5 hover:opacity-80 active:scale-95 transition cursor-pointer text-left"
        title="Открыть мой профиль"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-bold text-sm shadow-md ring-1 ring-white/20">
          {profile?.first_name ? profile.first_name[0].toUpperCase() : <UserIcon className="w-4 h-4" />}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-slate-200 leading-tight">
            {profile?.first_name || 'Загрузка...'}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {profile?.username ? `@${profile.username}` : `ID: ${profile?.id || '...'}`}
          </span>
        </div>
      </button>

      {/* Header Actions */}
      <div className="flex items-center gap-1.5">
        {/* Synthwave BGM Toggle */}
        <button
          onClick={toggleMusic}
          className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all cursor-pointer ${
            musicOn
              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-md shadow-purple-500/20 animate-pulse'
              : 'bg-slate-800/60 text-slate-400 border-white/10 hover:text-white'
          }`}
          title={musicOn ? 'Выключить неоновую музыку' : 'Включить Synthwave музыку'}
        >
          {musicOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Creator / Admin VIP Crown */}
        {isAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-500/20 to-yellow-500/10 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer shadow-md shadow-amber-500/20"
            title="Панель Создателя"
          >
            <Crown className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span>Root</span>
          </button>
        )}

        {/* Provably Fair Badge */}
        <button
          onClick={onOpenProvablyFair}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all cursor-pointer"
          title="Криптографическая проверка честности"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Fair</span>
        </button>
      </div>
    </header>
  );
};
