import { useState } from 'react';
import { Gamepad2, Users, Zap, ShieldCheck, AlertCircle } from 'lucide-react';
import { Header } from './components/Header.js';
import { Coin } from './components/Coin.js';
import { UpgraderModal } from './components/UpgraderModal.js';
import { TransfersModal } from './components/TransfersModal.js';
import { MiniGamesModal } from './components/games/MiniGamesModal.js';
import { ProvablyFairModal } from './components/ProvablyFairModal.js';
import { ProfileModal } from './components/profile/ProfileModal.js';
import { FriendsModal } from './components/friends/FriendsModal.js';
import { AnimatedNumber } from './components/AnimatedNumber.js';
import { useClicker } from './hooks/useClicker.js';

export function App() {
  const {
    profile,
    displayBalance,
    nextUpgrade,
    allUpgrades,
    loading,
    error,
    handleTap,
    flushClicks,
    updateBalanceDirectly,
    setNextUpgrade,
    setProfile,
  } = useClicker();

  // Modal visibility states
  const [isUpgraderOpen, setIsUpgraderOpen] = useState(false);
  const [isGamesOpen, setIsGamesOpen] = useState(false);
  const [isTransfersOpen, setIsTransfersOpen] = useState(false);
  const [isFairOpen, setIsFairOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [targetProfileId, setTargetProfileId] = useState<number | null>(null);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [prefillRecipient, setPrefillRecipient] = useState<string | undefined>(undefined);

  const openUpgrader = () => {
    flushClicks();
    setIsUpgraderOpen(true);
  };

  const openGames = () => {
    flushClicks();
    setIsGamesOpen(true);
  };

  const openFriends = () => {
    flushClicks();
    setIsFriendsOpen(true);
  };

  const openTransfers = (prefillUsername?: string) => {
    flushClicks();
    setPrefillRecipient(prefillUsername);
    setIsTransfersOpen(true);
  };

  const openFair = () => {
    setIsFairOpen(true);
  };

  const openMyProfile = () => {
    flushClicks();
    setTargetProfileId(null);
    setIsProfileOpen(true);
  };

  const openPlayerProfile = (userId: number) => {
    flushClicks();
    setTargetProfileId(userId);
    setIsProfileOpen(true);
  };

  if (loading && !profile) {
    return (
      <div className="min-h-screen bg-[#090c14] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold tracking-wider uppercase">Загрузка игры Токен...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090c14] text-slate-100 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden select-none pb-4">
      {/* Top Header */}
      <Header
        profile={profile}
        onOpenProvablyFair={openFair}
        onOpenProfile={openMyProfile}
      />

      {error && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Screen Content */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 pt-2">
        {/* Top: ВАШ СЧЕТ (Matching Screenshot 2 with Animated Number) */}
        <div className="flex flex-col items-center text-center mt-1">
          <span className="text-[11px] uppercase font-bold tracking-[0.2em] text-slate-400">
            ВАШ СЧЕТ
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-4xl sm:text-5xl font-black text-white font-sans tracking-tight">
              <AnimatedNumber value={displayBalance} />
            </div>
            <span className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-base shadow-md shadow-amber-500/30">
              🪙
            </span>
          </div>

          {/* Current Income per Tap Pill */}
          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/5 shadow-inner">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-300">
              +{(profile?.earn_per_click ?? 0.001) >= 1
                ? profile?.earn_per_click
                : (profile?.earn_per_click ?? 0.001).toFixed(3)} за тап
            </span>
          </div>
        </div>

        {/* Middle: Menu Cards Grid (Matching Screenshot 2 Cards Style) */}
        <div className="w-full grid grid-cols-4 gap-2.5 my-3">
          {/* Card 1: Игры (Pink/Magenta Icon) */}
          <button
            onClick={openGames}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#121622] border border-white/5 hover:border-pink-500/40 hover:bg-[#161d2c] transition-all transform active:scale-95 cursor-pointer shadow-lg group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#2a1329] border border-pink-500/30 flex items-center justify-center text-pink-400 shadow-md group-hover:scale-105 transition">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 mt-2">Игры</span>
          </button>

          {/* Card 2: Друзья (Blue Icon) */}
          <button
            onClick={openFriends}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#121622] border border-white/5 hover:border-blue-500/40 hover:bg-[#161d2c] transition-all transform active:scale-95 cursor-pointer shadow-lg group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#0f1f3d] border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 mt-2">Друзья</span>
          </button>

          {/* Card 3: Upgrader (Orange/Amber Icon) */}
          <button
            onClick={openUpgrader}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#121622] border border-white/5 hover:border-amber-500/40 hover:bg-[#161d2c] transition-all transform active:scale-95 cursor-pointer shadow-lg group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#2a1d0f] border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-md group-hover:scale-105 transition">
              <Zap className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 mt-2">Upgrader</span>
          </button>

          {/* Card 4: Честность (Green/Cyan Shield Icon) */}
          <button
            onClick={openFair}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#121622] border border-white/5 hover:border-emerald-500/40 hover:bg-[#161d2c] transition-all transform active:scale-95 cursor-pointer shadow-lg group"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#0e2722] border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md group-hover:scale-105 transition">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200 mt-2">Честность</span>
          </button>
        </div>

        {/* Bottom: Big Interactive Golden Coin */}
        <div className="w-full flex-1 flex items-center justify-center py-2">
          <Coin
            earnPerClick={profile?.earn_per_click || 0.001}
            onTap={handleTap}
          />
        </div>
      </main>

      {/* Modals */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={profile}
        balance={displayBalance}
        targetUserId={targetProfileId}
        onOpenFriends={() => setIsFriendsOpen(true)}
        onOpenFavorites={() => setIsGamesOpen(true)}
        onOpenTransfers={(prefill) => openTransfers(prefill)}
        onOpenPvpWithFriend={() => openGames()}
      />

      <FriendsModal
        isOpen={isFriendsOpen}
        onClose={() => setIsFriendsOpen(false)}
        onViewProfile={(uid) => openPlayerProfile(uid)}
        onOpenTransfers={(prefill) => openTransfers(prefill)}
        onOpenPvpWithFriend={() => openGames()}
      />

      <UpgraderModal
        isOpen={isUpgraderOpen}
        onClose={() => setIsUpgraderOpen(false)}
        profile={profile}
        nextUpgrade={nextUpgrade}
        allUpgrades={allUpgrades}
        onUpgradeSuccess={(upUser, nextNext) => {
          setProfile(upUser);
          setNextUpgrade(nextNext);
        }}
      />

      <MiniGamesModal
        isOpen={isGamesOpen}
        onClose={() => setIsGamesOpen(false)}
        profile={profile}
        balance={displayBalance}
        onBalanceUpdate={(newBal) => {
          updateBalanceDirectly(newBal);
        }}
      />

      <TransfersModal
        isOpen={isTransfersOpen}
        onClose={() => {
          setIsTransfersOpen(false);
          setPrefillRecipient(undefined);
        }}
        profile={profile}
        initialRecipient={prefillRecipient}
        onTransferSuccess={(newBal) => {
          updateBalanceDirectly(newBal);
        }}
      />

      <ProvablyFairModal
        isOpen={isFairOpen}
        onClose={() => setIsFairOpen(false)}
        profile={profile}
        onSeedUpdated={(newSeed) => {
          setProfile((prev) => (prev ? { ...prev, client_seed: newSeed } : null));
        }}
      />
    </div>
  );
}

export default App;
