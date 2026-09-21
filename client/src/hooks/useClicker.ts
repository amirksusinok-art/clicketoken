import { useState, useEffect, useRef, useCallback } from 'react';
import { apiRequest } from '../lib/api.js';
import { useTelegram } from './useTelegram.js';

export interface UserProfile {
  id: number;
  username: string | null;
  first_name: string;
  balance: number;
  earn_per_click: number;
  upgrade_level: number;
  client_seed: string;
  nonce: number;
  hide_public_balance?: number;
  mining_level?: number;
  referral_unclaimed?: number;
  active_coin_skin?: string;
  active_plane_skin?: string;
}

export interface UpgradeConfig {
  level: number;
  earnPerClick: number;
  cost: number;
  title: string;
}

export function useClicker() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nextUpgrade, setNextUpgrade] = useState<UpgradeConfig | null>(null);
  const [allUpgrades, setAllUpgrades] = useState<UpgradeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact } = useTelegram();

  // Optimistic balance
  const [displayBalance, setDisplayBalance] = useState<number>(0);

  // Click queue refs to avoid closure staleness
  const pendingClicksRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const earnPerClickRef = useRef<number>(0.001);
  const isSyncingRef = useRef<boolean>(false);

  // Load user data
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{
        user: UserProfile;
        nextUpgrade: UpgradeConfig | null;
        upgrades: UpgradeConfig[];
      }>('/api/user/me');

      setProfile(data.user);
      setDisplayBalance(data.user.balance);
      setNextUpgrade(data.nextUpgrade);
      setAllUpgrades(data.upgrades);
      earnPerClickRef.current = data.user.earn_per_click;
      setError(null);
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(err.message || 'Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Flush pending clicks to server
  const flushClicks = useCallback(async () => {
    const clicks = pendingClicksRef.current;
    if (clicks <= 0 || isSyncingRef.current) return;

    const deltaMs = Date.now() - lastSyncTimeRef.current;
    isSyncingRef.current = true;
    pendingClicksRef.current = 0;
    lastSyncTimeRef.current = Date.now();

    try {
      const res = await apiRequest<{
        success: boolean;
        balance: number;
        added: number;
        verifiedClicks: number;
      }>('/api/user/click-batch', {
        method: 'POST',
        body: JSON.stringify({ clicks, deltaMs }),
      });

      if (res.success) {
        // Sync with verified balance from server
        setDisplayBalance(() => {
          // If user made more clicks while request was flying, keep them on top
          const ongoingClicks = pendingClicksRef.current;
          return res.balance + ongoingClicks * earnPerClickRef.current;
        });
        setProfile((prev) => (prev ? { ...prev, balance: res.balance } : null));
      }
    } catch (err) {
      console.error('Click sync error:', err);
      // restore unsynced clicks if failed
      pendingClicksRef.current += clicks;
    } finally {
      isSyncingRef.current = false;
    }
  }, []);

  // Periodic flush interval (every 2.5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingClicksRef.current > 0) {
        flushClicks();
      }
    }, 2500);

    return () => {
      clearInterval(interval);
      flushClicks();
    };
  }, [flushClicks]);

  // Tap handler
  const handleTap = useCallback(() => {
    const earn = earnPerClickRef.current;
    pendingClicksRef.current += 1;
    setDisplayBalance((prev) => Math.round((prev + earn) * 10000) / 10000);
    hapticImpact('light');
  }, [hapticImpact]);

  // Direct balance update (for game wins/losses/transfers)
  const updateBalanceDirectly = useCallback((newBalance: number) => {
    setDisplayBalance(newBalance);
    setProfile((prev) => (prev ? { ...prev, balance: newBalance } : null));
  }, []);

  return {
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
  };
}
