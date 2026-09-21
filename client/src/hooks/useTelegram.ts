import { useEffect, useCallback } from 'react';

export function useTelegram() {
  const tg = (window as any).Telegram?.WebApp;
  const isInsideTelegram = Boolean(tg?.initData);

  useEffect(() => {
    try {
      if (tg) {
        if (typeof tg.ready === 'function') {
          try {
            tg.ready();
          } catch {}
        }
        if (typeof tg.expand === 'function') {
          try {
            tg.expand();
          } catch {}
        }
        // Set header color to dark background safely
        if (typeof tg.setHeaderColor === 'function') {
          try {
            tg.setHeaderColor('#0a0d14');
          } catch {
            try {
              tg.setHeaderColor('bg_color');
            } catch {}
          }
        }
        if (typeof tg.setBackgroundColor === 'function') {
          try {
            tg.setBackgroundColor('#0a0d14');
          } catch {
            try {
              tg.setBackgroundColor('bg_color');
            } catch {}
          }
        }
      }
    } catch (e) {
      console.warn('Telegram WebApp initialization caught:', e);
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
