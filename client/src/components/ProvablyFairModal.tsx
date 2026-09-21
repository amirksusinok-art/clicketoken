import { useState } from 'react';
import { X, ShieldCheck, CheckCircle, Calculator, Key } from 'lucide-react';
import { apiRequest } from '../lib/api.js';
import type { UserProfile } from '../hooks/useClicker.js';

interface ProvablyFairModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSeedUpdated: (newSeed: string) => void;
}

// Browser-native HMAC-SHA256 calculation
async function sha256HmacHex(keyStr: string, messageStr: string): Promise<string> {
  const enc = new TextEncoder();
  const keyData = enc.encode(keyStr);
  const msgData = enc.encode(messageStr);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(msgStr: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(msgStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const ProvablyFairModal: React.FC<ProvablyFairModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSeedUpdated,
}) => {
  const [clientSeedInput, setClientSeedInput] = useState(profile?.client_seed || '');
  const [savingSeed, setSavingSeed] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);

  // Verifier tool state
  const [verifyServerSeed, setVerifyServerSeed] = useState('');
  const [verifyClientSeed, setVerifyClientSeed] = useState(profile?.client_seed || '');
  const [verifyNonce, setVerifyNonce] = useState('1');
  const [verifyGame, setVerifyGame] = useState<'hilo' | 'crash' | 'random' | 'airplane'>('hilo');
  const [verifyResult, setVerifyResult] = useState<any>(null);

  if (!isOpen || !profile) return null;

  const handleSaveClientSeed = async () => {
    if (!clientSeedInput.trim()) return;
    try {
      setSavingSeed(true);
      const res = await apiRequest<{ success: boolean; clientSeed: string }>('/api/user/seed', {
        method: 'POST',
        body: JSON.stringify({ clientSeed: clientSeedInput.trim() }),
      });
      if (res.success) {
        onSeedUpdated(res.clientSeed);
        setSeedMsg('Client Seed успешно обновлен');
        setTimeout(() => setSeedMsg(null), 3000);
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка смены seed');
    } finally {
      setSavingSeed(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyServerSeed.trim()) return;

    const sSeed = verifyServerSeed.trim();
    const cSeed = verifyClientSeed.trim();
    const nonce = parseInt(verifyNonce || '1', 10);

    const calculatedHash = await sha256Hex(sSeed);
    const hmac = await sha256HmacHex(sSeed, `${cSeed}:${nonce}`);

    let outcomeText = '';

    if (verifyGame === 'hilo') {
      const num = parseInt(hmac.substring(0, 8), 16) % 1000000;
      outcomeText = `Выпавшее число: ${String(num).padStart(6, '0')}`;
    } else if (verifyGame === 'crash') {
      const h = parseInt(hmac.substring(0, 13), 16);
      const e = Math.pow(2, 52);
      let cp = 1.0;
      if (h % 33 !== 0) {
        cp = Math.min(1000.0, Math.max(1.0, Math.floor(((100 * e - h) / (e - h)) * 100) / 100));
      }
      outcomeText = `Точка краша: ${cp.toFixed(2)}x`;
    } else if (verifyGame === 'random') {
      const num = parseInt(hmac.substring(0, 8), 16) % 10000;
      let mult = 0;
      const tiers = [
        { mult: 0, w: 3500 },
        { mult: 0.5, w: 2500 },
        { mult: 1.0, w: 2000 },
        { mult: 1.5, w: 1000 },
        { mult: 2.0, w: 600 },
        { mult: 3.0, w: 300 },
        { mult: 5.0, w: 100 },
      ];
      let acc = 0;
      for (const t of tiers) {
        acc += t.w;
        if (num < acc) {
          mult = t.mult;
          break;
        }
      }
      outcomeText = `Выпавший сектор: ×${mult} (точка: ${num})`;
    } else if (verifyGame === 'airplane') {
      const eventCount = (parseInt(hmac[0], 16) % 2) === 0 ? 3 : 4;
      let mult = 1.0;
      const events: string[] = [];
      for (let i = 0; i < eventCount; i++) {
        const val = parseInt(hmac.substring(2 + i * 2, 4 + i * 2), 16) % 100;
        if (val < 60) {
          mult = Math.round(mult * 1.5 * 100) / 100;
          events.push('Кольцо ×1.5');
        } else {
          mult = Math.max(1.0, Math.round((mult / 1.5) * 100) / 100);
          events.push('Ракета ÷1.5');
        }
      }
      const landingVal = parseInt(hmac.substring(12, 14), 16) % 100;
      const landing = landingVal < 75;
      outcomeText = `Полёт: ${events.join(', ')} -> Посадка: ${landing ? 'Успешно' : 'Крушение'} (Итог: ${landing ? mult.toFixed(2) + 'x' : '0.00x'})`;
    }

    setVerifyResult({
      serverSeedHash: calculatedHash,
      hmac,
      outcomeText,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#121722] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-[#161c2b]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Provably Fair</h2>
              <p className="text-[11px] text-slate-400">Криптографическая честность SHA-256</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Explanation Banner */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-slate-300 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
              <CheckCircle className="w-3.5 h-3.5" />
              Как работает доказательство честности?
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              1. Сервер заранее генерирует секретный <strong>Server Seed</strong> и публикует его{' '}
              <strong>SHA-256 хэш</strong> до вашей ставки.<br />
              2. Результат вычисляется математически:{' '}
              <code>HMAC-SHA256(ServerSeed, ClientSeed + Nonce)</code>.<br />
              3. После раунда исходный Server Seed раскрывается, и вы можете проверить, что исход не мог быть изменён.
            </p>
          </div>

          {/* Client Seed Management */}
          <div className="space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-sky-400" />
                Ваш Client Seed
              </span>
              <span className="text-[10px] text-slate-400">Nonce: {profile.nonce}</span>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={clientSeedInput}
                onChange={(e) => setClientSeedInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
              <button
                disabled={savingSeed}
                onClick={handleSaveClientSeed}
                className="px-3 py-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-lg transition cursor-pointer"
              >
                Сохранить
              </button>
            </div>
            {seedMsg && <div className="text-[11px] text-emerald-400">{seedMsg}</div>}
          </div>

          {/* Independent Verifier Tool */}
          <form onSubmit={handleVerify} className="space-y-3 p-3.5 rounded-xl bg-slate-900/60 border border-white/5">
            <div className="flex items-center gap-1.5 font-bold text-slate-200">
              <Calculator className="w-3.5 h-3.5 text-amber-400" />
              Калькулятор проверки раунда
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px]">Игра:</label>
              <select
                value={verifyGame}
                onChange={(e: any) => setVerifyGame(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              >
                <option value="hilo">Больше / Меньше (0–999999)</option>
                <option value="crash">Crash (Мультиплеер)</option>
                <option value="airplane">Самолётик (Полёт и препятствия)</option>
                <option value="random">Random (Сектора вероятностей)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px]">Раскрытый Server Seed:</label>
              <input
                type="text"
                placeholder="64 hex символа..."
                value={verifyServerSeed}
                onChange={(e) => setVerifyServerSeed(e.target.value)}
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px]">Client Seed:</label>
                <input
                  type="text"
                  value={verifyClientSeed}
                  onChange={(e) => setVerifyClientSeed(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px]">Nonce:</label>
                <input
                  type="number"
                  value={verifyNonce}
                  onChange={(e) => setVerifyNonce(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition cursor-pointer"
            >
              Проверить результат
            </button>

            {verifyResult && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 space-y-1.5 font-mono text-[10px]">
                <div className="text-emerald-300 font-bold text-xs">{verifyResult.outcomeText}</div>
                <div className="text-slate-400 truncate">
                  SHA-256 хэш: {verifyResult.serverSeedHash}
                </div>
                <div className="text-slate-500 truncate">HMAC: {verifyResult.hmac}</div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
