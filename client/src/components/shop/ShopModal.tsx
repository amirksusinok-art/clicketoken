import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, Palette, Plane, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface SkinItem {
  id: string;
  type: 'coin' | 'plane';
  name: string;
  cost: number;
  description: string;
  accentColor: string;
  glowColor: string;
  isOwned: boolean;
  isEquipped: boolean;
}

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  activeCoinSkin: string;
  activePlaneSkin: string;
  onBalanceUpdate: (newBalance: number) => void;
  onSkinChange: (type: 'coin' | 'plane', skinId: string) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  balance,
  activeCoinSkin,
  activePlaneSkin,
  onBalanceUpdate,
  onSkinChange,
}) => {
  const [items, setItems] = useState<SkinItem[]>([]);
  const [activeTab, setActiveTab] = useState<'coin' | 'plane'>('coin');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { hapticImpact, hapticNotification } = useTelegram();

  const loadCatalog = async () => {
    try {
      const res = await apiRequest<{
        success: boolean;
        items: SkinItem[];
        activeCoinSkin: string;
        activePlaneSkin: string;
      }>('/api/shop/items');

      if (res.success) {
        setItems(res.items);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки магазина');
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCatalog();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBuy = async (skin: SkinItem) => {
    if (balance < skin.cost || processingId) return;

    try {
      setProcessingId(skin.id);
      setError(null);
      hapticImpact('heavy');

      const res = await apiRequest<{
        success: boolean;
        balance: number;
        activeCoinSkin: string;
        activePlaneSkin: string;
      }>('/api/shop/buy', {
        method: 'POST',
        body: JSON.stringify({ skinId: skin.id, type: skin.type }),
      });

      if (res.success) {
        onBalanceUpdate(res.balance);
        onSkinChange(skin.type, skin.id);
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 65,
          spread: 70,
          origin: { y: 0.6 },
          colors: [skin.accentColor, skin.glowColor, '#ffffff'],
        });
        loadCatalog();
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка покупки скина');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEquip = async (skin: SkinItem) => {
    if (processingId) return;

    try {
      setProcessingId(skin.id);
      setError(null);
      hapticImpact('medium');

      const res = await apiRequest<{
        success: boolean;
        activeCoinSkin: string;
        activePlaneSkin: string;
      }>('/api/shop/equip', {
        method: 'POST',
        body: JSON.stringify({ skinId: skin.id, type: skin.type }),
      });

      if (res.success) {
        onSkinChange(skin.type, skin.id);
        hapticNotification('success');
        soundManager.playCoinTap();
        loadCatalog();
      }
    } catch (err: any) {
      hapticNotification('error');
      setError(err.message || 'Ошибка смены скина');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredItems = items.filter((i) => i.type === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90vh] bg-slate-900 border border-white/10 rounded-3xl p-5 shadow-2xl flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide flex items-center gap-1.5">
                Магазин скинов 🎨
              </h2>
              <p className="text-xs text-slate-400">Кастомизация монеты и 3D-самолётика</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-white/5 mt-3 shrink-0">
          <button
            onClick={() => setActiveTab('coin')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'coin'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>🪙</span>
            <span>Скины Монеты</span>
          </button>
          <button
            onClick={() => setActiveTab('plane')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'plane'
                ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>✈️</span>
            <span>3D-Самолётик</span>
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto pt-3 space-y-3 pr-0.5 scrollbar-thin">
          <div className="text-xs text-slate-400 px-1 flex items-center justify-between">
            <span>Доступные стили:</span>
            <span>
              Баланс: <strong className="text-emerald-400 font-mono">{formatTokens(balance)}</strong> T
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {filteredItems.map((skin) => {
              const isEquipped =
                skin.type === 'coin' ? activeCoinSkin === skin.id : activePlaneSkin === skin.id;
              const canAfford = balance >= skin.cost;
              const isProcessing = processingId === skin.id;

              return (
                <div
                  key={skin.id}
                  className={`p-3.5 rounded-2xl border transition-all relative overflow-hidden ${
                    isEquipped
                      ? 'bg-slate-800/90 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                      : skin.isOwned
                      ? 'bg-slate-800/50 border-white/15'
                      : 'bg-slate-900/50 border-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Skin Preview Badge */}
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner shrink-0 relative overflow-hidden"
                        style={{
                          background: `radial-gradient(circle at 30% 30%, ${skin.accentColor}, #090d16)`,
                          borderColor: skin.glowColor,
                          boxShadow: `0 0 15px ${skin.glowColor}40`,
                        }}
                      >
                        {skin.type === 'coin' ? (
                          <span className="text-xl">
                            {skin.id === 'bitcoin'
                              ? '₿'
                              : skin.id === 'cyberpunk'
                              ? '⚡'
                              : skin.id === 'meteorite'
                              ? '☄️'
                              : '🪙'}
                          </span>
                        ) : (
                          <Plane className="w-5 h-5 text-white" />
                        )}
                      </div>

                      <div>
                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                          <span>{skin.name}</span>
                          {skin.cost === 0 && (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              Базовый
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                          {skin.description}
                        </div>
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="shrink-0">
                      {isEquipped ? (
                        <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Надето
                        </span>
                      ) : skin.isOwned ? (
                        <button
                          onClick={() => handleEquip(skin)}
                          disabled={isProcessing}
                          className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs transition-all"
                        >
                          {isProcessing ? '...' : 'Надеть'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBuy(skin)}
                          disabled={isProcessing || !canAfford}
                          className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition-all ${
                            canAfford
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-md shadow-yellow-500/20 active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5'
                          }`}
                        >
                          <span>{isProcessing ? '...' : `${formatTokens(skin.cost)} T`}</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
