import React, { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Timer,
  User,
  RotateCw,
  Search,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BetControls } from './BetControls.js';
import { apiRequest } from '../../lib/api.js';
import { formatTokens } from '../../lib/formatters.js';
import { soundManager } from '../../lib/sound.js';
import { useTelegram } from '../../hooks/useTelegram.js';

interface WheelPvpGameProps {
  balance: number;
  username: string;
  onBalanceUpdate: (newBalance: number) => void;
  onBack?: () => void;
}

interface PvpPlayer {
  userId: number;
  username: string;
  avatarLetter: string;
  isBot: boolean;
  selectedSector?: number;
  confirmed: boolean;
}

interface PvpMatch {
  matchId: string;
  bet: number;
  pot: number;
  commission: number;
  payout: number;
  player1: PvpPlayer;
  player2: PvpPlayer;
  status: 'SELECTING' | 'SPINNING' | 'FINISHED' | 'CANCELLED';
  createdAt: number;
  countdownEndsAt: number;
  serverSeed?: string;
  serverSeedHash?: string;
  winningSector?: number;
  winnerId?: number | null;
  respinsCount: number;
  tieBreak: boolean;
}

const SECTOR_CONFIGS = [
  { value: 0, label: '×0', color: '#ef4444', gradient: 'from-red-600 to-rose-700', bg: 'bg-red-500/20 border-red-500/40 text-red-400' },
  { value: 0.5, label: '×0.5', color: '#f97316', gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-500/20 border-orange-500/40 text-orange-400' },
  { value: 1.0, label: '×1', color: '#0ea5e9', gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-500/20 border-sky-500/40 text-sky-400' },
  { value: 1.5, label: '×1.5', color: '#06b6d4', gradient: 'from-cyan-500 to-teal-600', bg: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' },
  { value: 2.0, label: '×2', color: '#8b5cf6', gradient: 'from-purple-500 to-indigo-600', bg: 'bg-purple-500/20 border-purple-500/40 text-purple-400' },
  { value: 3.0, label: '×3', color: '#ec4899', gradient: 'from-pink-500 to-rose-600', bg: 'bg-pink-500/20 border-pink-500/40 text-pink-400' },
  { value: 5.0, label: '×5', color: '#eab308', gradient: 'from-yellow-400 to-amber-500', bg: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 font-bold' },
];

export const WheelPvpGame: React.FC<WheelPvpGameProps> = ({
  balance,
  username,
  onBalanceUpdate,
}) => {
  const [stage, setStage] = useState<'IDLE' | 'SEARCHING' | 'SELECTING' | 'COUNTDOWN' | 'SPINNING' | 'RESULT'>('IDLE');
  const [bet, setBet] = useState(5.0);
  const [match, setMatch] = useState<PvpMatch | null>(null);
  const [selectedSector, setSelectedSector] = useState<number | null>(null);
  const [opponentSector, setOpponentSector] = useState<number | null>(null);
  const [countdownNum, setCountdownNum] = useState<number>(3);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [isWon, setIsWon] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [recentGames, setRecentGames] = useState<any[]>([]);

  const { hapticImpact, hapticNotification } = useTelegram();
  const searchTimeoutRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Fetch recent PvP history
  useEffect(() => {
    apiRequest<{ history: any[] }>('/api/games/history?gameType=pvp_wheel&limit=6')
      .then((data) => {
        if (data && data.history) {
          setRecentGames(data.history);
        }
      })
      .catch(() => {});
  }, [stage]);

  // 1. Search for Match
  const handleFindMatch = async () => {
    if (balance < bet) {
      setError('Недостаточно токенов на балансе');
      return;
    }
    setError(null);
    setStage('SEARCHING');
    hapticImpact('medium');

    // Simulate search delay (1.5s) for realistic matchmaking feel
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await apiRequest<{
          success: boolean;
          match: PvpMatch;
          balance: number;
        }>('/api/games/pvp-wheel/find-match', {
          method: 'POST',
          body: JSON.stringify({ bet }),
        });

        if (res.success && res.match) {
          setMatch(res.match);
          onBalanceUpdate(res.balance);
          setSelectedSector(null);
          setOpponentSector(res.match.player2.selectedSector ?? null);
          setStage('SELECTING');
          setTimeLeft(15);
          hapticNotification('success');

          // 15-second countdown timer for sector selection
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                clearInterval(timerIntervalRef.current);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (err: any) {
        setError(err.message || 'Ошибка поиска матча');
        setStage('IDLE');
        hapticNotification('error');
      }
    }, 1800);
  };

  const handleCancelSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setStage('IDLE');
  };

  // 2. Select Sector and Confirm
  const handleConfirmSector = async () => {
    if (!match || selectedSector === null) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    hapticImpact('heavy');
    try {
      const res = await apiRequest<{
        success: boolean;
        match: PvpMatch;
        balance: number;
      }>('/api/games/pvp-wheel/select-sector', {
        method: 'POST',
        body: JSON.stringify({
          matchId: match.matchId,
          sector: selectedSector,
        }),
      });

      if (res.success && res.match) {
        const updatedMatch = res.match;
        setMatch(updatedMatch);
        setOpponentSector(updatedMatch.player2.selectedSector ?? null);

        // Start 3... 2... 1... countdown
        setStage('COUNTDOWN');
        setCountdownNum(3);
        hapticImpact('medium');

        let count = 3;
        const countInterval = setInterval(() => {
          count--;
          if (count > 0) {
            setCountdownNum(count);
            hapticImpact('light');
          } else {
            clearInterval(countInterval);
            startWheelSpin(updatedMatch, res.balance);
          }
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка подтверждения сектора');
      hapticNotification('error');
    }
  };

  // 3. Wheel Spin Animation
  const startWheelSpin = (finalMatch: PvpMatch, updatedBalance: number) => {
    setStage('SPINNING');

    const winningSector = finalMatch.winningSector ?? 0;
    const sectorIndex = SECTOR_CONFIGS.findIndex((s) => s.value === winningSector);
    const validIndex = sectorIndex >= 0 ? sectorIndex : 0;

    // Angle calculation:
    // 7 sectors = 360 / 7 = 51.42857 degrees per sector.
    // Sector 0 center is at angle (0.5 * segmentAngle).
    // Pointer is at top (12 o'clock = 0 deg / 360 deg).
    // To place sector validIndex at top:
    // targetAngle = 360 - (validIndex + 0.5) * segmentAngle
    const segmentAngle = 360 / 7;
    const targetSectorCenter = (validIndex + 0.5) * segmentAngle;
    const fullSpins = 360 * 5; // 5 complete rotations
    const finalAngle = fullSpins + (360 - targetSectorCenter);

    setRotationAngle(finalAngle);

    // Realistic mechanical wheel ticks that slow down
    const tickTimes = [
      80, 160, 240, 320, 400, 480, 560, 650, 750, 860, 980, 1110, 1250, 1400,
      1570, 1760, 1970, 2200, 2460, 2750, 3070, 3420, 3800
    ];
    tickTimes.forEach((ms) => {
      setTimeout(() => {
        soundManager.playWheelTick();
        hapticImpact('light');
      }, ms);
    });

    // Spin duration 4.2 seconds
    setTimeout(() => {
      setStage('RESULT');
      const isPlayerWinner = finalMatch.winnerId === finalMatch.player1.userId;
      setIsWon(isPlayerWinner);
      onBalanceUpdate(updatedBalance);

      if (isPlayerWinner) {
        hapticNotification('success');
        soundManager.playVictoryFanfare();
        confetti({
          particleCount: 75,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#eab308', '#38bdf8', '#a855f7', '#10b981'],
        });
      } else {
        hapticNotification('error');
      }
    }, 4200);
  };

  const handleReset = () => {
    setStage('IDLE');
    setMatch(null);
    setSelectedSector(null);
    setOpponentSector(null);
    setRotationAngle(0);
    setError(null);
  };

  // Render Wheel SVG
  const renderWheelSvg = () => {
    const radius = 120;
    const innerRadius = 32;
    const segmentAngle = (2 * Math.PI) / 7;

    return (
      <div className="relative w-64 h-64 sm:w-72 sm:h-72 mx-auto flex items-center justify-center my-2">
        {/* Pointer Arrow at Top (12 o'clock) */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none drop-shadow-[0_4px_10px_rgba(234,179,8,0.7)]">
          <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-amber-400" />
          <div className="w-2.5 h-2.5 -mt-1 rounded-full bg-yellow-300 ring-2 ring-amber-600 shadow-md" />
        </div>

        {/* Outer Glow Ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-amber-500/20 via-sky-500/10 to-purple-500/20 blur-xl scale-95" />

        {/* Wheel Container with Hardware-Accelerated CSS Rotation */}
        <div
          className="w-full h-full rounded-full relative transition-transform"
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transitionDuration: stage === 'SPINNING' ? '4.2s' : '0s',
            transitionTimingFunction: 'cubic-bezier(0.12, 0.8, 0.15, 1)',
          }}
        >
          <svg viewBox="-140 -140 280 280" className="w-full h-full filter drop-shadow-2xl">
            <defs>
              {/* Outer Golden Border Gradient */}
              <radialGradient id="rimGrad" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="#1e293b" />
                <stop offset="90%" stopColor="#334155" />
                <stop offset="100%" stopColor="#f59e0b" />
              </radialGradient>

              {/* Hub Gradient */}
              <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#854d0e" />
              </radialGradient>
            </defs>

            {/* Outer Rim */}
            <circle cx="0" cy="0" r="132" fill="none" stroke="#f59e0b" strokeWidth="5" className="opacity-90" />
            <circle cx="0" cy="0" r="128" fill="#0f172a" stroke="#1e293b" strokeWidth="4" />

            {/* Sectors */}
            {SECTOR_CONFIGS.map((sector, idx) => {
              // 0 angle is at top (-PI/2)
              const startA = idx * segmentAngle - Math.PI / 2;
              const endA = (idx + 1) * segmentAngle - Math.PI / 2;
              const midA = (idx + 0.5) * segmentAngle - Math.PI / 2;

              const x1 = radius * Math.cos(startA);
              const y1 = radius * Math.sin(startA);
              const x2 = radius * Math.cos(endA);
              const y2 = radius * Math.sin(endA);

              const ix1 = innerRadius * Math.cos(startA);
              const iy1 = innerRadius * Math.sin(startA);
              const ix2 = innerRadius * Math.cos(endA);
              const iy2 = innerRadius * Math.sin(endA);

              const textRadius = radius * 0.68;
              const tx = textRadius * Math.cos(midA);
              const ty = textRadius * Math.sin(midA);
              const textRotation = ((midA + Math.PI / 2) * 180) / Math.PI;

              const pathData = `M ${ix1} ${iy1} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerRadius} ${innerRadius} 0 0 0 ${ix1} ${iy1} Z`;

              return (
                <g key={sector.value}>
                  <path
                    d={pathData}
                    fill={sector.color}
                    fillOpacity="0.88"
                    stroke="#0f172a"
                    strokeWidth="2.5"
                  />
                  {/* Sector Multiplier Text */}
                  <text
                    x={tx}
                    y={ty + 4}
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="900"
                    fontFamily="monospace"
                    textAnchor="middle"
                    transform={`rotate(${textRotation}, ${tx}, ${ty})`}
                    style={{
                      textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    {sector.label}
                  </text>
                </g>
              );
            })}

            {/* Rim Studs / Pins */}
            {Array.from({ length: 14 }).map((_, i) => {
              const pinA = (i * (2 * Math.PI)) / 14;
              const px = 125 * Math.cos(pinA);
              const py = 125 * Math.sin(pinA);
              return <circle key={i} cx={px} cy={py} r="2.5" fill="#fef08a" stroke="#ca8a04" strokeWidth="1" />;
            })}

            {/* Center Golden Hub */}
            <circle cx="0" cy="0" r="32" fill="url(#hubGrad)" stroke="#78350f" strokeWidth="3" />
            <circle cx="0" cy="0" r="24" fill="#0f172a" stroke="#ca8a04" strokeWidth="1.5" />
            <text
              x="0"
              y="5"
              fill="#fbbf24"
              fontSize="12"
              fontWeight="900"
              fontFamily="sans-serif"
              textAnchor="middle"
            >
              VS
            </text>
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3.5 select-none">
      {/* 1. STAGE: IDLE */}
      {stage === 'IDLE' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Hero Banner */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/30 p-4 shadow-xl">
            <div className="relative z-10 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-purple-400">
                  <Swords className="w-3.5 h-3.5" />
                  PVP 1 НА 1 ДУЭЛЬ
                </div>
                <h2 className="text-lg font-black text-white leading-tight">
                  Колесо против игрока
                </h2>
                <p className="text-[11px] text-slate-300">
                  Оба ставят поровну и выбирают сектор. Побеждает выпавший сектор!
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-500/30 to-indigo-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shadow-inner shrink-0">
                <Swords className="w-6 h-6" />
              </div>
            </div>

            {/* Rules badges */}
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
                <span className="text-slate-400 block">Мин. ставка</span>
                <strong className="text-white font-mono">5 ТОКЕН</strong>
              </div>
              <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
                <span className="text-slate-400 block">Выигрыш</span>
                <strong className="text-emerald-400 font-mono">1.8x банк</strong>
              </div>
              <div className="bg-white/5 rounded-lg py-1 px-1.5 border border-white/5">
                <span className="text-slate-400 block">Комиссия</span>
                <strong className="text-sky-400 font-mono">10%</strong>
              </div>
            </div>
          </div>

          {/* Static Preview Wheel */}
          <div className="relative">
            {renderWheelSvg()}
          </div>

          {/* Bet Controls */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-3.5 shadow-md">
            <BetControls
              bet={bet}
              onBetChange={setBet}
              balance={balance}
              disabled={false}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Find Match Button */}
          <button
            onClick={handleFindMatch}
            disabled={balance < bet}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            <span>Найти игрока ({bet} Т)</span>
          </button>

          {/* Recent Matches */}
          {recentGames.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-[11px] uppercase font-bold text-slate-400 flex items-center gap-1 px-1">
                <RotateCw className="w-3.5 h-3.5" />
                Недавние дуэли
              </div>
              <div className="space-y-1.5">
                {recentGames.map((g, idx) => {
                  const details = g.details ? JSON.parse(g.details) : {};
                  const isWin = g.multiplier > 0;
                  return (
                    <div
                      key={idx}
                      className="bg-slate-900/50 border border-white/5 rounded-xl px-3 py-2 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isWin ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-slate-300 font-sans font-medium">
                          vs {details.opponent || 'Соперник'}
                        </span>
                        <span className="text-slate-500 text-[10px]">
                          (Сектор: ×{details.winningSector ?? '?'})
                        </span>
                      </div>
                      <span className={`font-bold ${isWin ? 'text-emerald-400' : 'text-slate-400'}`}>
                        {isWin ? `+${formatTokens(g.payout)} Т` : `-${formatTokens(g.bet)} Т`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. STAGE: SEARCHING */}
      {stage === 'SEARCHING' && (
        <div className="py-8 flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-200">
          {/* Radar Scanner Animation */}
          <div className="relative w-44 h-44 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping opacity-30" />
            <div className="absolute inset-4 rounded-full border border-indigo-500/40 animate-pulse" />
            <div className="absolute inset-8 rounded-full border border-sky-500/50" />
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-purple-500/40 z-10">
              <Swords className="w-8 h-8 animate-bounce" />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h3 className="text-base font-black text-white uppercase tracking-wider">
              Поиск соперника...
            </h3>
            <p className="text-xs text-slate-400">
              Ставка матча: <strong className="text-sky-400 font-mono">{bet} ТОКЕН</strong>
            </p>
          </div>

          <button
            onClick={handleCancelSearch}
            className="px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition cursor-pointer border border-white/10"
          >
            Отмена
          </button>
        </div>
      )}

      {/* 3. STAGE: SELECTING */}
      {stage === 'SELECTING' && match && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* VS Match Card */}
          <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-purple-950/60 border border-white/10 rounded-2xl p-3.5 shadow-lg flex items-center justify-between">
            {/* Player 1 (You) */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm ring-2 ring-emerald-500/50 shadow-md">
                {username[0]?.toUpperCase() || <User className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-black text-white leading-tight">
                  {username}
                </div>
                <div className="text-[10px] text-emerald-400 font-bold">
                  {selectedSector !== null ? `Сектор ×${selectedSector}` : 'Выбирает...'}
                </div>
              </div>
            </div>

            {/* Center VS + Timer */}
            <div className="flex flex-col items-center px-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                БАНК: {match.pot} Т
              </span>
              <div className="flex items-center gap-1 text-amber-400 font-mono font-black text-sm my-0.5">
                <Timer className="w-4 h-4 animate-pulse" />
                <span>{timeLeft}s</span>
              </div>
              <span className="text-[9px] text-purple-400 font-bold uppercase">
                1.8x приз
              </span>
            </div>

            {/* Player 2 (Opponent) */}
            <div className="flex items-center gap-2.5 text-right flex-row-reverse">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white font-black text-sm ring-2 ring-rose-500/50 shadow-md">
                {match.player2.avatarLetter || <User className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-black text-white leading-tight truncate max-w-[90px]">
                  {match.player2.username}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  {match.player2.confirmed ? (
                    <span className="text-rose-400 flex items-center gap-0.5 justify-end">
                      <CheckCircle2 className="w-3 h-3" /> Готов
                    </span>
                  ) : (
                    'Выбирает...'
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sector Selection Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase text-slate-300 tracking-wider">
                Выберите ваш сектор:
              </span>
              <span className="text-[10px] text-slate-500">
                1 сектор на выбор
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {SECTOR_CONFIGS.map((sector) => {
                const isSelected = selectedSector === sector.value;
                return (
                  <button
                    key={sector.value}
                    onClick={() => {
                      setSelectedSector(sector.value);
                      hapticImpact('light');
                    }}
                    className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-sky-400 scale-105 shadow-lg bg-sky-500/30 border-sky-400 text-white'
                        : `${sector.bg} hover:border-white/30`
                    }`}
                  >
                    <span className="text-base font-black font-mono">
                      {sector.label}
                    </span>
                    <span className="text-[9px] uppercase font-bold text-slate-400">
                      Сектор
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wheel Preview */}
          <div className="opacity-90 scale-90">
            {renderWheelSvg()}
          </div>

          {/* Confirm Button */}
          <button
            onClick={handleConfirmSector}
            disabled={selectedSector === null}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selectedSector !== null
              ? `Подтвердить выбор (${selectedSector === 0 ? '×0' : `×${selectedSector}`})`
              : 'Выберите сектор выше'}
          </button>
        </div>
      )}

      {/* 4. STAGE: COUNTDOWN */}
      {stage === 'COUNTDOWN' && (
        <div className="py-12 flex flex-col items-center justify-center space-y-6 animate-in zoom-in-95 duration-200">
          <div className="w-28 h-28 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black text-6xl shadow-2xl shadow-yellow-500/40 animate-bounce">
            {countdownNum}
          </div>

          <div className="text-center space-y-1">
            <h3 className="text-lg font-black text-white uppercase tracking-widest">
              ПРИГОТОВЬТЕСЬ!
            </h3>
            <p className="text-xs text-slate-400">
              Вы выбрали: <strong className="text-sky-400 font-mono">×{selectedSector}</strong> vs Соперник:{' '}
              <strong className="text-rose-400 font-mono">×{opponentSector}</strong>
            </p>
          </div>
        </div>
      )}

      {/* 5. STAGE: SPINNING */}
      {stage === 'SPINNING' && match && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Match VS Ribbon */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-white/10 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span className="text-white font-bold">{username} (×{selectedSector})</span>
            </div>
            <span className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">КРУТИМ...</span>
            <div className="flex items-center gap-1.5">
              <span className="text-rose-300 font-bold">{match.player2.username} (×{opponentSector})</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
            </div>
          </div>

          {/* Active Spinning Wheel */}
          {renderWheelSvg()}

          {match.respinsCount > 0 && (
            <div className="text-center text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 py-2 px-3 rounded-xl">
              ⚡ Секторы игроков не выпали с первого раза, докручиваем до выигрыша!
            </div>
          )}
        </div>
      )}

      {/* 6. STAGE: RESULT */}
      {stage === 'RESULT' && match && (
        <div className="space-y-4 animate-in zoom-in-95 duration-300">
          {/* Victory or Defeat Card */}
          <div
            className={`rounded-2xl border p-5 text-center space-y-3 shadow-2xl ${
              isWon
                ? 'bg-gradient-to-b from-emerald-950/80 via-slate-900 to-teal-950/80 border-emerald-500/40 shadow-emerald-500/20'
                : 'bg-gradient-to-b from-rose-950/80 via-slate-900 to-red-950/80 border-rose-500/40 shadow-rose-500/20'
            }`}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 border border-white/20 shadow-inner text-3xl">
              {isWon ? '🏆' : '💀'}
            </div>

            <div className="space-y-1">
              <h3
                className={`text-xl font-black uppercase tracking-wider ${
                  isWon ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isWon ? 'ВЫ ПОБЕДИЛИ!' : 'ВЫ ПРОИГРАЛИ'}
              </h3>

              <div className="text-2xl font-black font-mono text-white">
                {isWon ? `+${formatTokens(match.payout)} ТОКЕН` : `-${formatTokens(match.bet)} ТОКЕН`}
              </div>
            </div>

            {/* Tie break notice if both chose same sector */}
            {match.tieBreak && (
              <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                Оба игрока выбрали сектор ×{match.winningSector}! Победитель определён жребием 50/50.
              </p>
            )}

            {/* Match Summary Breakdown */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div className="bg-black/30 rounded-lg p-2">
                <span className="text-slate-400 block text-[9px] uppercase font-sans">Ваш выбор</span>
                <strong className="text-sky-400 text-xs">×{selectedSector}</strong>
              </div>
              <div className="bg-black/30 rounded-lg p-2">
                <span className="text-slate-400 block text-[9px] uppercase font-sans">Выпало</span>
                <strong className="text-amber-400 text-xs">×{match.winningSector}</strong>
              </div>
              <div className="bg-black/30 rounded-lg p-2">
                <span className="text-slate-400 block text-[9px] uppercase font-sans">Соперник</span>
                <strong className="text-rose-400 text-xs">×{opponentSector}</strong>
              </div>
            </div>
          </div>

          {/* Wheel showing landed position */}
          <div className="scale-90 opacity-95">
            {renderWheelSvg()}
          </div>

          {/* Provably Fair Badge */}
          {match.serverSeedHash && (
            <div className="p-2.5 bg-slate-900/60 border border-white/5 rounded-xl flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Provably Fair Hash:</span>
              </div>
              <span className="font-mono text-slate-300 truncate max-w-[140px]">
                {match.serverSeedHash}
              </span>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleReset}
            className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/30 active:scale-[0.98] transition cursor-pointer"
          >
            Сыграть ещё раз
          </button>
        </div>
      )}
    </div>
  );
};
