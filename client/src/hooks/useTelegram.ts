import { useEffect, useCallback } from 'react';

export function useTelegram() {
  const tg = (window as any).Telegram?.WebApp;
  const isInsideTelegram = Boolean(tg?.initData);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      // Set header color to dark background
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#0a0d14');
      }
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#0a0d14');
      }
    }
  }, [tg]);

  const hapticImpact = useCallback(
    (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'light') => {
      if (tg?.HapticFeedback) {
        try {
          tg.HapticFeedback.impactOccurred(style);
        } catch (e) {
          // ignore
        }
      }
    },
    [tg]
  );

  const hapticNotification = useCallback(
    (type: 'error' | 'success' | 'warning') => {
      if (tg?.HapticFeedback) {
        try {
          tg.HapticFeedback.notificationOccurred(type);
        } catch (e) {
          // ignore
        }
      }
    },
    [tg]
  );

  const hapticSelectionChanged = useCallback(() => {
    if (tg?.HapticFeedback?.selectionChanged) {
      try {
        tg.HapticFeedback.selectionChanged();
      } catch (e) {
        // ignore
      }
    }
  }, [tg]);

  const openTelegramLink = useCallback(
    (url: string) => {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(url);
      } else {
        window.open(url, '_blank');
      }
    },
    [tg]
  );

  const user = tg?.initDataUnsafe?.user || null;

  return {
    tg,
    isInsideTelegram,
    user,
    hapticImpact,
    hapticNotification,
    hapticSelectionChanged,
    openTelegramLink,
  };
}
