import React, { useState, useRef, useCallback } from 'react';
import { soundManager } from '../lib/sound.js';

interface Particle {
  id: number;
  x: number;
  y: number;
  text: string;
  subText?: string;
}

interface CoinProps {
  earnPerClick: number;
  onTap: () => void;
  skin?: string;
}

export const Coin: React.FC<CoinProps> = ({ earnPerClick, onTap, skin = 'default' }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0, isPressed: false });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const [particles, setParticles] = useState<Particle[]>([]);
  const coinWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextParticleId = useRef(0);
  const resetTimeoutRef = useRef<any>(null);

  const activeSkin = skin || 'default';

  // Skin styling configuration
  const skinConfig = {
    default: {
      aura: 'from-amber-500/25 via-yellow-500/15 to-amber-600/20',
      outerBorder: 'from-amber-700 via-yellow-500 to-amber-300 shadow-[0_12px_40px_rgba(234,179,8,0.35)]',
      rimBg: 'bg-[#171104]',
      rimBorder: 'border-amber-400/60',
      particleClass: 'text-amber-300 drop-shadow-[0_2px_10px_rgba(245,158,11,0.9)]',
      particleIcon: '✨',
      gradStops: (
        <>
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="25%" stopColor="#facc15" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="75%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </>
      ),
      textColor: '#78350f',
      textLabel: '★ TOKEN ★ 01101000 ★ OFFICIAL ★ 01100100 ★',
      accentColor: '#ca8a04',
      centerIcon: (
        <g filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))">
          <path d="M66 60 H134 V80 H110 V142 H90 V80 H66 Z" fill="#78350f" />
          <path d="M68 62 H132 V78 H108 V140 H92 V78 H68 Z" fill="url(#coinFaceGrad)" />
          <path d="M72 65 H128 V73 H104 V136 H96 V73 H72 Z" fill="#fef08a" />
        </g>
      ),
    },
    cyberpunk: {
      aura: 'from-cyan-500/30 via-fuchsia-500/20 to-blue-600/25',
      outerBorder: 'from-cyan-400 via-fuchsia-500 to-indigo-500 shadow-[0_12px_40px_rgba(6,182,212,0.45)]',
      rimBg: 'bg-[#090417]',
      rimBorder: 'border-cyan-400/70',
      particleClass: 'text-cyan-300 drop-shadow-[0_2px_10px_rgba(6,182,212,0.9)]',
      particleIcon: '⚡',
      gradStops: (
        <>
          <stop offset="0%" stopColor="#67e8f9" />
          <stop offset="30%" stopColor="#06b6d4" />
          <stop offset="70%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4c1d95" />
        </>
      ),
      textColor: '#06b6d4',
      textLabel: '⚡ CYBERPUNK ⚡ MATRIX ⚡ 2077 ⚡ PROTOCOL ⚡',
      accentColor: '#06b6d4',
      centerIcon: (
        <g filter="drop-shadow(0 0 10px rgba(6,182,212,0.8))">
          <path d="M66 60 H134 V80 H110 V142 H90 V80 H66 Z" fill="#2e1065" />
          <path d="M68 62 H132 V78 H108 V140 H92 V78 H68 Z" fill="url(#coinFaceGrad)" />
          <path d="M72 65 H128 V73 H104 V136 H96 V73 H72 Z" fill="#a5f3fc" />
          <circle cx="100" cy="100" r="14" fill="#06b6d4" opacity="0.8" />
          <circle cx="100" cy="100" r="6" fill="#ffffff" />
        </g>
      ),
    },
    bitcoin: {
      aura: 'from-amber-500/35 via-orange-500/25 to-yellow-500/30',
      outerBorder: 'from-orange-600 via-amber-400 to-yellow-200 shadow-[0_12px_40px_rgba(245,158,11,0.45)]',
      rimBg: 'bg-[#1a0f02]',
      rimBorder: 'border-amber-300/80',
      particleClass: 'text-amber-300 drop-shadow-[0_2px_10px_rgba(245,158,11,0.95)]',
      particleIcon: '₿',
      gradStops: (
        <>
          <stop offset="0%" stopColor="#fde047" />
          <stop offset="35%" stopColor="#f59e0b" />
          <stop offset="75%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </>
      ),
      textColor: '#78350f',
      textLabel: '₿ BITCOIN ₿ DIGITAL GOLD ₿ BLOCKCHAIN ₿ BTC ₿',
      accentColor: '#f59e0b',
      centerIcon: (
        <g filter="drop-shadow(0 4px 8px rgba(0,0,0,0.6))">
          <circle cx="100" cy="100" r="38" fill="url(#coinFaceGrad)" stroke="#fef08a" strokeWidth="2" />
          <text
            x="100"
            y="114"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="46"
            fontWeight="900"
            fontFamily="monospace, sans-serif"
            filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))"
          >
            ₿
          </text>
        </g>
      ),
    },
    meteorite: {
      aura: 'from-red-600/35 via-orange-600/25 to-rose-700/30',
      outerBorder: 'from-red-700 via-orange-500 to-stone-800 shadow-[0_12px_40px_rgba(239,68,68,0.45)]',
      rimBg: 'bg-[#140505]',
      rimBorder: 'border-red-500/70',
      particleClass: 'text-orange-400 drop-shadow-[0_2px_10px_rgba(239,68,68,0.95)]',
      particleIcon: '🔥',
      gradStops: (
        <>
          <stop offset="0%" stopColor="#f87171" />
          <stop offset="30%" stopColor="#ea580c" />
          <stop offset="70%" stopColor="#b91c1c" />
          <stop offset="100%" stopColor="#450a0a" />
        </>
      ),
      textColor: '#f87171',
      textLabel: '☄️ METEORITE ☄️ COSMIC MAGMA ☄️ ASTEROID ☄️',
      accentColor: '#ef4444',
      centerIcon: (
        <g filter="drop-shadow(0 0 12px rgba(239,68,68,0.9))">
          {/* Molten Cracks Core */}
          <circle cx="100" cy="100" r="36" fill="#1c1917" stroke="#ef4444" strokeWidth="2" />
          <path
            d="M 80 80 Q 95 100 85 120 M 100 70 L 100 130 M 120 85 Q 105 105 118 125"
            stroke="#f97316"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="100" cy="100" r="12" fill="#ea580c" />
          <circle cx="100" cy="100" r="6" fill="#fef08a" />
        </g>
      ),
    },
  };

  const currentConfig = (skinConfig as any)[activeSkin] || skinConfig.default;

  const triggerTap = useCallback(
    (clientX?: number, clientY?: number) => {
      soundManager.playCoinTap();

      let tiltX = 0;
      let tiltY = 0;
      let gX = 50;
      let gY = 50;

      if (coinWrapperRef.current && clientX !== undefined && clientY !== undefined) {
        const rect = coinWrapperRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const dx = (clientX - centerX) / (rect.width / 2);
        const dy = (clientY - centerY) / (rect.height / 2);

        tiltY = Math.max(-18, Math.min(18, dx * 18));
        tiltX = Math.max(-18, Math.min(18, -dy * 18));

        gX = Math.max(10, Math.min(90, 50 + dx * 35));
        gY = Math.max(10, Math.min(90, 50 + dy * 35));
      }

      setTilt({ x: tiltX, y: tiltY, isPressed: true });
      setGlarePos({ x: gX, y: gY });

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        let posX = rect.width / 2;
        let posY = rect.height / 2;

        if (clientX !== undefined && clientY !== undefined) {
          posX = clientX - rect.left;
          posY = clientY - rect.top;
        }

        const id = nextParticleId.current++;
        const formattedEarn = earnPerClick >= 1 ? `+${earnPerClick}` : `+${earnPerClick.toFixed(3)}`;

        setParticles((prev) => [
          ...prev.slice(-14),
          { id, x: posX, y: posY, text: formattedEarn, subText: currentConfig.particleIcon },
        ]);

        setTimeout(() => {
          setParticles((prev) => prev.filter((p) => p.id !== id));
        }, 850);
      }

      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => {
        setTilt({ x: 0, y: 0, isPressed: false });
        setGlarePos({ x: 50, y: 50 });
      }, 140);

      onTap();
    },
    [earnPerClick, onTap, currentConfig.particleIcon]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    triggerTap(e.clientX, e.clientY);
  };

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center select-none touch-manipulation w-full my-auto"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Ambient Pulsing Aura with Skin Accent */}
      <div
        className={`absolute w-72 h-72 sm:w-88 sm:h-88 rounded-full bg-gradient-to-tr ${currentConfig.aura} blur-3xl pointer-events-none animate-pulse-glow`}
      />

      {/* 3D Perspective Wrapper */}
      <div
        ref={coinWrapperRef}
        onPointerDown={handlePointerDown}
        className="cursor-pointer select-none relative group"
        style={{
          perspective: '1000px',
        }}
      >
        {/* Ground Shadow */}
        <div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-52 sm:w-64 h-9 bg-black/80 blur-xl rounded-full pointer-events-none transition-transform duration-150"
          style={{
            transform: `translateX(-50%) scale(${tilt.isPressed ? 0.92 : 1})`,
          }}
        />

        {/* 3D Coin Body with Interactive Dynamic Tilt */}
        <div
          className="relative w-64 h-64 sm:w-76 sm:h-76 md:w-84 md:h-84 rounded-full will-change-transform"
          style={{
            transformStyle: 'preserve-3d',
            transform: tilt.isPressed
              ? `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(0.95)`
              : 'rotateX(4deg) rotateY(0deg) scale(1)',
            transition: tilt.isPressed
              ? 'transform 0.05s ease-out'
              : 'transform 0.35s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
          }}
        >
          {/* Outer Chamfered Reeded Edge */}
          <div
            className={`absolute inset-0 rounded-full bg-gradient-to-tr ${currentConfig.outerBorder} p-[8px]`}
          >
            {/* Inner Dark Rim with Grooves */}
            <div
              className={`w-full h-full rounded-full ${currentConfig.rimBg} p-[5px] border-2 ${currentConfig.rimBorder} relative overflow-hidden flex items-center justify-center`}
            >
              {/* Detailed Coin SVG Face */}
              <svg
                viewBox="0 0 200 200"
                className="w-full h-full select-none pointer-events-none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <linearGradient id="coinFaceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    {currentConfig.gradStops}
                  </linearGradient>

                  <radialGradient id="coinSunburst" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
                    <stop offset="60%" stopColor={currentConfig.accentColor} stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
                  </radialGradient>

                  <path
                    id="outerCoinTextCircle"
                    d="M 100, 100 m -84, 0 a 84,84 0 1,1 168,0 a 84,84 0 1,1 -168,0"
                  />
                </defs>

                {/* Base Relief Circles */}
                <circle cx="100" cy="100" r="95" fill="url(#coinFaceGrad)" />
                <circle cx="100" cy="100" r="88" fill={activeSkin === 'cyberpunk' ? '#1e1035' : activeSkin === 'meteorite' ? '#271010' : '#b45309'} stroke={currentConfig.accentColor} strokeWidth="1.2" />
                <circle cx="100" cy="100" r="78" fill="url(#coinSunburst)" />

                {/* Reeded Edge Marks */}
                {Array.from({ length: 36 }).map((_, i) => {
                  const angle = (i * 360) / 36;
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 89 * Math.cos(rad);
                  const y1 = 100 + 89 * Math.sin(rad);
                  const x2 = 100 + 94 * Math.cos(rad);
                  const y2 = 100 + 94 * Math.sin(rad);
                  return (
                    <line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={currentConfig.accentColor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Circular Inscribed Text */}
                <text fill={currentConfig.textColor} fontSize="6.5" fontWeight="900" letterSpacing="2" fontFamily="monospace">
                  <textPath href="#outerCoinTextCircle" startOffset="0%">
                    {currentConfig.textLabel}
                  </textPath>
                </text>

                {/* Circuits / Details */}
                <g stroke={currentConfig.accentColor} strokeWidth="1.4" opacity="0.6" strokeLinecap="round">
                  <path d="M 38 60 L 64 60 L 78 74" />
                  <circle cx="38" cy="60" r="2" fill={currentConfig.accentColor} />
                  <path d="M 162 60 L 136 60 L 122 74" />
                  <circle cx="162" cy="60" r="2" fill={currentConfig.accentColor} />
                  <path d="M 38 140 L 64 140 L 78 126" />
                  <circle cx="38" cy="140" r="2" fill={currentConfig.accentColor} />
                  <path d="M 162 140 L 136 140 L 122 126" />
                  <circle cx="162" cy="140" r="2" fill={currentConfig.accentColor} />
                </g>

                {/* Central Custom Emblem */}
                {currentConfig.centerIcon}
              </svg>

              {/* Dynamic Specular Light Glare Sweep */}
              <div
                className="absolute inset-0 rounded-full pointer-events-none transition-opacity duration-150"
                style={{
                  background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 40%, transparent 70%)`,
                  opacity: tilt.isPressed ? 0.9 : 0.45,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className={`floating-particle font-black flex items-center gap-1 ${currentConfig.particleClass}`}
          style={{
            left: `${p.x}px`,
            top: `${p.y}px`,
          }}
        >
          <span className="text-xl sm:text-2xl font-mono">{p.text}</span>
          <span className="text-sm animate-ping">{p.subText}</span>
        </div>
      ))}
    </div>
  );
};
