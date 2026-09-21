import { useState } from 'react';
import { Gamepad2, Users, Zap, ShieldCheck, AlertCircle, Cpu, Gift, Palette, Vault, Flame, Send } from 'lucide-react';
import { Header } from './components/Header.js';
import { Coin } from './components/Coin.js';
import { UpgraderModal } from './components/UpgraderModal.js';
import { TransfersModal } from './components/TransfersModal.js';
import { MiniGamesModal } from './components/games/MiniGamesModal.js';
import { ProvablyFairModal } from './components/ProvablyFairModal.js';
import { ProfileModal } from './components/profile/ProfileModal.js';
import { FriendsModal } from './components/friends/FriendsModal.js';
import { FarmingModal } from './components/farming/FarmingModal.js';
import { ReferralsModal } from './components/referrals/ReferralsModal.js';
import { ShopModal } from './components/shop/ShopModal.js';
import { AdminModal } from './components/admin/AdminModal.js';
import { StakingModal } from './components/staking/StakingModal.js';
import { DailyStreakModal } from './components/daily/DailyStreakModal.js';
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
    fetchProfile,
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
  const [isFarmingOpen, setIsFarmingOpen] = useState(false);
  const [isReferralsOpen, setIsReferralsOpen] = useState(false);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isStakingOpen, setIsStakingOpen] = useState(false);
  const [isDailyOpen, setIsDailyOpen] = useState(false);
  const [isMenuDrawerOpen, setIsMenuDrawerOpen] = useState(false);
  const [prefillRecipient, setPrefillRecipient] = useState<string | undefined>(undefined);

  const openUpgrader = () => {
    flushClicks();
    setIsUpgraderOpen(true);
  };

  const openFarming = () => {
    flushClicks();
    setIsFarmingOpen(true);
  };

  const openReferrals = () => {
    flushClicks();
    setIsReferralsOpen(true);
  };

  const openShop = () => {
    flushClicks();
    setIsShopOpen(true);
  };

  const openAdmin = () => {
    flushClicks();
    setIsAdminOpen(true);
  };

  const openStaking = () => {
    flushClicks();
    setIsStakingOpen(true);
  };

  const openDaily = () => {
    flushClicks();
    setIsDailyOpen(true);
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

  if (!profile) {
    if (loading) {
      return (
        <div className="min-h-screen bg-[#090c14] flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold tracking-wider uppercase">Загрузка игры Токен...</span>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#090c14] flex flex-col items-center justify-center text-slate-400 gap-4 p-6 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 animate-pulse" />
        <div>
          <h2 className="text-white font-bold text-base mb-1">Связь с сервером</h2>
          <p className="text-xs text-slate-400 max-w-xs">{error || 'Не удалось загрузить данные аккаунта. Попробуйте повторить.'}</p>
        </div>
        <button
          onClick={() => fetchProfile()}
          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer shadow-lg shadow-amber-500/20"
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090c14] text-slate-100 flex flex-col justify-between max-w-md mx-auto relative overflow-hidden select-none pb-20">
      {/* Top Header */}
      <Header
        profile={profile}
        onOpenProvablyFair={openFair}
        onOpenProfile={openMyProfile}
        onOpenAdmin={openAdmin}
      />

      {error && (
        <div className="mx-4 mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Screen Content (Clean Notcoin / Blum Style) */}
      <main className="flex-1 flex flex-col items-center justify-between px-4 pt-3 pb-2">
        {/* Top: ВАШ СЧЕТ & Income Pill */}
        <div className="flex flex-col items-center text-center mt-1">
          <span className="text-[11px] uppercase font-bold tracking-[0.25em] text-slate-400">
            ВАШ СЧЕТ
          </span>
          <div className="flex items-center gap-2 mt-1">
            <div className="text-4xl sm:text-5xl font-black text-white font-sans tracking-tight">
              <AnimatedNumber value={displayBalance} />
            </div>
            <span className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black text-base shadow-lg shadow-amber-500/30">
              🪙
            </span>
          </div>

          {/* Income & Bonus Badges Row */}
          <div className="mt-2.5 flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/80 border border-white/5 shadow-inner">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-slate-300">
                +{(profile?.earn_per_click ?? 0.00001) >= 1
                  ? profile?.earn_per_click
                  : (profile?.earn_per_click ?? 0.00001) < 0.01
                  ? (profile?.earn_per_click ?? 0.00001).toFixed(5)
                  : (profile?.earn_per_click ?? 0.00001).toFixed(3)}{' '}
                за тап
              </span>
            </div>

            {/* Daily Streak Indicator */}
            <button
              onClick={openDaily}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold hover:bg-amber-500/20 active:scale-95 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 animate-bounce" />
              <span>{(profile?.daily_streak ?? 0) > 0 ? `${profile?.daily_streak} дн.` : 'Бонус'}</span>
            </button>
          </div>
        </div>

        {/* Center Stage: Hero Interactive Coin */}
        <div className="w-full flex-1 flex items-center justify-center py-6">
          <Coin
            earnPerClick={profile?.earn_per_click || 0.001}
            onTap={handleTap}
            skin={profile?.active_coin_skin || 'default'}
          />
        </div>
      </main>

      {/* Sleek Bottom Navigation Dock (Telegram WebApp Native Style) */}
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto z-40 px-3 pb-3 pt-1 pointer-events-auto">
        <div className="w-full bg-[#0d1322]/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-black/80 flex items-center justify-around">
          {/* Tab 1: Игры (Games) */}
          <button
            onClick={openGames}
            className="flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl hover:bg-white/5 active:scale-95 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400 group-hover:scale-105 transition shadow-sm">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-1">Игры</span>
          </button>

          {/* Tab 2: Ферма (Farm) */}
          <button
            onClick={openFarming}
            className="flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl hover:bg-white/5 active:scale-95 transition cursor-pointer group relative"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition shadow-sm">
              <Cpu className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-1">Ферма</span>
            {(profile?.mining_level ?? 0) > 0 && (
              <span className="absolute top-1 right-2 px-1 py-0.2 bg-emerald-500 text-slate-950 rounded text-[8px] font-mono font-black">
                L{profile?.mining_level}
              </span>
            )}
          </button>

          {/* Tab 3: Буст (Upgrader) */}
          <button
            onClick={openUpgrader}
            className="flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl hover:bg-white/5 active:scale-95 transition cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition shadow-sm">
              <Zap className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-1">Буст</span>
          </button>

          {/* Tab 4: Друзья (Friends & Referrals) */}
          <button
            onClick={openFriends}
            className="flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl hover:bg-white/5 active:scale-95 transition cursor-pointer group relative"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-1">Друзья</span>
            {(profile?.referral_unclaimed ?? 0) > 0 && (
              <span className="absolute top-1 right-2 px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded-full text-[8px] font-mono font-black animate-pulse">
                +{(profile?.referral_unclaimed ?? 0).toFixed(0)}
              </span>
            )}
          </button>

          {/* Tab 5: Ещё (More Services) */}
          <button
            onClick={() => setIsMenuDrawerOpen(true)}
            className="flex-1 py-1.5 flex flex-col items-center justify-center rounded-xl hover:bg-white/5 active:scale-95 transition cursor-pointer group relative"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition shadow-sm">
              <Vault className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-300 mt-1">Ещё</span>
            <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-[#0d1322]" />
          </button>
        </div>
      </nav>

      {/* Quick Menu Drawer / Sheet */}
      {isMenuDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-3 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#0d1322] border border-white/10 rounded-3xl p-4 shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-white uppercase tracking-wider">Сервисы и Бонусы</span>
              </div>
              <button
                onClick={() => setIsMenuDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              {/* Staking Vault */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openStaking();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 hover:border-emerald-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <Vault className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Сейф (Стейкинг)</div>
                    <div className="text-[10px] text-slate-400">До +30% пассивного дохода</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                  +30%
                </span>
              </button>

              {/* 7-Day Streak */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openDaily();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/30 hover:border-amber-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">7 Дней Стрик</div>
                    <div className="text-[10px] text-slate-400">Ежедневный бонус за вход</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/30">
                  {(profile?.daily_streak ?? 0) > 0 ? `${profile?.daily_streak}д 🔥` : 'Бонус'}
                </span>
              </button>

              {/* Skins Wardrobe */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openShop();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900 border border-purple-500/30 hover:border-purple-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                    <Palette className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Магазин скинов</div>
                    <div className="text-[10px] text-slate-400">Скины для монеты и ракеты</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-purple-400">Скины</span>
              </button>

              {/* Referrals 2.0 */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openReferrals();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border border-amber-500/30 hover:border-amber-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Рефералы 2.0</div>
                    <div className="text-[10px] text-slate-400">Приглашай друзей и получай %</div>
                  </div>
                </div>
                {(profile?.referral_unclaimed ?? 0) > 0 ? (
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 animate-pulse">
                    +{(profile?.referral_unclaimed ?? 0).toFixed(1)} Т
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-400">Бонус</span>
                )}
              </button>

              {/* Transfers */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openTransfers();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-500/30 hover:border-blue-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Переводы игрокам</div>
                    <div className="text-[10px] text-slate-400">Мгновенно по юзернейму</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-blue-400">Перевод</span>
              </button>

              {/* Provably Fair */}
              <button
                onClick={() => {
                  setIsMenuDrawerOpen(false);
                  openFair();
                }}
                className="w-full p-2.5 rounded-2xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/30 hover:border-cyan-400 flex items-center justify-between transition cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">Честность (Fair)</div>
                    <div className="text-[10px] text-slate-400">Криптографическая проверка SHA-256</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400">SHA-256</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

      <FarmingModal
        isOpen={isFarmingOpen}
        onClose={() => setIsFarmingOpen(false)}
        balance={displayBalance}
        onBalanceUpdate={(newBal) => updateBalanceDirectly(newBal)}
      />

      <ReferralsModal
        isOpen={isReferralsOpen}
        onClose={() => setIsReferralsOpen(false)}
        onBalanceUpdate={(newBal) => {
          updateBalanceDirectly(newBal);
          setProfile((prev) => (prev ? { ...prev, referral_unclaimed: 0 } : null));
        }}
      />

      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        balance={displayBalance}
        activeCoinSkin={profile?.active_coin_skin || 'default'}
        activePlaneSkin={profile?.active_plane_skin || 'default'}
        onBalanceUpdate={(newBal) => updateBalanceDirectly(newBal)}
        onSkinChange={(type, skinId) => {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  active_coin_skin: type === 'coin' ? skinId : prev.active_coin_skin,
                  active_plane_skin: type === 'plane' ? skinId : prev.active_plane_skin,
                }
              : null
          );
        }}
      />

      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        myUserId={profile?.id || 5394575689}
        currentBalance={displayBalance}
        onBalanceUpdate={(newBal) => updateBalanceDirectly(newBal)}
      />

      <StakingModal
        isOpen={isStakingOpen}
        onClose={() => setIsStakingOpen(false)}
        balance={displayBalance}
        onBalanceUpdate={(newBal) => updateBalanceDirectly(newBal)}
      />

      <DailyStreakModal
        isOpen={isDailyOpen}
        onClose={() => setIsDailyOpen(false)}
        onBalanceUpdate={(newBal) => {
          updateBalanceDirectly(newBal);
          setProfile((prev) => (prev ? { ...prev, daily_streak: (prev.daily_streak || 0) + 1 } : null));
        }}
      />
    </div>
  );
}

export default App;
