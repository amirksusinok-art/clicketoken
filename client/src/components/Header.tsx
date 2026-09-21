import React from 'react';
import { ShieldCheck, User as UserIcon } from 'lucide-react';
import type { UserProfile } from '../hooks/useClicker.js';

interface HeaderProps {
  profile: UserProfile | null;
  onOpenProvablyFair: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  onOpenProvablyFair,
  onOpenProfile,
}) => {
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

      {/* Provably Fair Badge */}
      <div className="flex items-center gap-2">
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
