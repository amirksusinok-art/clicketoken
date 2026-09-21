import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Obstacle3D {
  id: string;
  type: 'ring' | 'rocket';
  timestampMs: number;
  multiplierFactor: number;
  position: { x: number; y: number; z: number };
}

interface Airplane3DSceneProps {
  flightPhase: 'idle' | 'takeoff' | 'flying' | 'landing' | 'result';
  elapsedMs: number;
  obstacles: Obstacle3D[];
  landingSuccess: boolean;
  multiplier?: number;
  planeSkin?: string;
  onObstacleHit?: (obstacleId: string, type: 'ring' | 'rocket') => void;
}

interface SmokeParticle {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface FireParticle {
  mesh: THREE.Mesh;
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export const Airplane3DScene: React.FC<Airplane3DSceneProps> = ({
  flightPhase,
  obstacles,
  landingSuccess,
  multiplier = 1.0,
  planeSkin = 'default',
  onObstacleHit,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const planeGroupRef = useRef<THREE.Group | null>(null);
  const leftFlameGroupRef = useRef<THREE.Group | null>(null);
  const rightFlameGroupRef = useRef<THREE.Group | null>(null);
  const obstaclesMeshMap = useRef<Map<string, THREE.Object3D>>(new Map());
  const triggeredObstacles = useRef<Set<string>>(new Set());
  const animFrameIdRef = useRef<number | null>(null);

  // Synchronized state refs to decouple render loop from React state updates
  const phaseRef = useRef(flightPhase);
  phaseRef.current = flightPhase;
  const landingSuccessRef = useRef(landingSuccess);
  landingSuccessRef.current = landingSuccess;
  const multiplierRef = useRef(multiplier);
  multiplierRef.current = multiplier;
  const obstaclesRef = useRef(obstacles);
  obstaclesRef.current = obstacles;
  const onHitRef = useRef(onObstacleHit);
  onHitRef.current = onObstacleHit;

  // Ultra-smooth Continuous Time Reference
  const flightStartTimeRef = useRef<number | null>(null);
  const crashTriggeredRef = useRef<boolean>(false);

  // Dynamic Camera & FX refs
  const fovKickRef = useRef<number>(0);
  const shakeIntensityRef = useRef<number>(0);
  const smokePoolRef = useRef<SmokeParticle[]>([]);
  const firePoolRef = useRef<FireParticle[]>([]);

  // Contrail Ribbon Trails
  const leftTrailGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const rightTrailGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const leftTrailLineRef = useRef<THREE.Line | null>(null);
  const rightTrailLineRef = useRef<THREE.Line | null>(null);
  const leftTrailHistory = useRef<THREE.Vector3[]>([]);
  const rightTrailHistory = useRef<THREE.Vector3[]>([]);

  // Track phase changes to start continuous clock
  useEffect(() => {
    if (flightPhase === 'takeoff') {
      flightStartTimeRef.current = performance.now();
      crashTriggeredRef.current = false;
      triggeredObstacles.current.clear();
    } else if (flightPhase === 'idle') {
      flightStartTimeRef.current = null;
      crashTriggeredRef.current = false;
      triggeredObstacles.current.clear();
      leftTrailHistory.current = [];
      rightTrailHistory.current = [];
    }
  }, [flightPhase]);

  // Main Scene Initialization (Runs once per skin change)
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 320;
    const height = mountRef.current.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#050811');
    scene.fog = new THREE.FogExp2('#050811', 0.005);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Skin Palette configuration
    const skinPalettes: Record<string, {
      fuselage: string;
      wing: string;
      cockpit: string;
      plume: string;
      trail: string;
      sunLight: string;
      metalness: number;
      roughness: number;
    }> = {
      default: {
        fuselage: '#0284c7',
        wing: '#0369a1',
        cockpit: '#38bdf8',
        plume: '#0ea5e9',
        trail: '#38bdf8',
        sunLight: '#38bdf8',
        metalness: 0.85,
        roughness: 0.25,
      },
      stealth: {
        fuselage: '#18181b',
        wing: '#27272a',
        cockpit: '#a855f7',
        plume: '#9333ea',
        trail: '#c084fc',
        sunLight: '#a855f7',
        metalness: 0.5,
        roughness: 0.65,
      },
      dragon: {
        fuselage: '#dc2626',
        wing: '#991b1b',
        cockpit: '#facc15',
        plume: '#ea580c',
        trail: '#f97316',
        sunLight: '#f97316',
        metalness: 0.8,
        roughness: 0.3,
      },
    };

    const palette = skinPalettes[planeSkin] || skinPalettes.default;

    // Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(palette.sunLight, 2.4);
    sunLight.position.set(25, 45, 30);
    scene.add(sunLight);

    const bottomGlow = new THREE.DirectionalLight('#10b981', 1.0);
    bottomGlow.position.set(0, -20, -100);
    scene.add(bottomGlow);

    // Airplane 3D Model
    const planeGroup = new THREE.Group();

    // Fuselage
    const fuselageGeo = new THREE.ConeGeometry(0.95, 4.8, 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: palette.fuselage,
      roughness: palette.roughness,
      metalness: palette.metalness,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    planeGroup.add(fuselage);

    // Cockpit
    const cockpitGeo = new THREE.SphereGeometry(0.5, 16, 12);
    cockpitGeo.scale(0.75, 0.55, 1.9);
    const cockpitMat = new THREE.MeshPhysicalMaterial({
      color: palette.cockpit,
      transmission: 0.6,
      opacity: 0.9,
      transparent: true,
      roughness: 0.1,
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.48, -0.35);
    planeGroup.add(cockpit);

    // Main Wings
    const wingGeo = new THREE.BoxGeometry(6.4, 0.12, 2.1);
    const wingMat = new THREE.MeshStandardMaterial({
      color: palette.wing,
      roughness: palette.roughness + 0.1,
      metalness: palette.metalness - 0.1,
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0, 0.3);
    planeGroup.add(wings);

    // Vertical Stabilizer
    const finGeo = new THREE.BoxGeometry(0.12, 1.35, 1.2);
    const fin = new THREE.Mesh(finGeo, wingMat);
    fin.position.set(0, 0.78, 1.4);
    planeGroup.add(fin);

    // Engines
    const engineMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.4,
      metalness: 0.9,
    });
    const thrusterGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.7, 14);
    thrusterGeo.rotateX(Math.PI / 2);

    const leftThruster = new THREE.Mesh(thrusterGeo, engineMat);
    leftThruster.position.set(-0.65, 0, 2.1);
    const rightThruster = new THREE.Mesh(thrusterGeo, engineMat);
    rightThruster.position.set(0.65, 0, 2.1);
    planeGroup.add(leftThruster);
    planeGroup.add(rightThruster);

    // Afterburners
    const createFlameGroup = () => {
      const group = new THREE.Group();
      const plumeGeo = new THREE.ConeGeometry(0.36, 2.4, 12);
      plumeGeo.rotateX(Math.PI / 2);
      const plumeMat = new THREE.MeshBasicMaterial({
        color: palette.plume,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      });
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.set(0, 0, 1.2);
      group.add(plume);

      const coreGeo = new THREE.ConeGeometry(0.18, 1.5, 10);
      coreGeo.rotateX(Math.PI / 2);
      const coreMat = new THREE.MeshBasicMaterial({
        color: '#ffffff',
        transparent: true,
        opacity: 0.95,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.set(0, 0, 0.75);
      group.add(core);

      return group;
    };

    const leftFlame = createFlameGroup();
    leftFlame.position.set(-0.65, 0, 2.45);
    planeGroup.add(leftFlame);
    leftFlameGroupRef.current = leftFlame;

    const rightFlame = createFlameGroup();
    rightFlame.position.set(0.65, 0, 2.45);
    planeGroup.add(rightFlame);
    rightFlameGroupRef.current = rightFlame;

    scene.add(planeGroup);
    planeGroupRef.current = planeGroup;

    // Wingtip Ribbon Trails
    const trailMat = new THREE.LineBasicMaterial({
      color: palette.trail,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
    });
    const leftTrailGeo = new THREE.BufferGeometry();
    const rightTrailGeo = new THREE.BufferGeometry();
    const leftTrailLine = new THREE.Line(leftTrailGeo, trailMat);
    const rightTrailLine = new THREE.Line(rightTrailGeo, trailMat);

    scene.add(leftTrailLine);
    scene.add(rightTrailLine);
    leftTrailGeoRef.current = leftTrailGeo;
    rightTrailGeoRef.current = rightTrailGeo;
    leftTrailLineRef.current = leftTrailLine;
    rightTrailLineRef.current = rightTrailLine;

    // Smoke Particles Pool
    const smokeGroup = new THREE.Group();
    const smokeGeo = new THREE.DodecahedronGeometry(0.5, 1);
    const smokePool: SmokeParticle[] = [];

    for (let i = 0; i < 20; i++) {
      const smokeMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.9,
        transparent: true,
        opacity: 0,
      });
      const smk = new THREE.Mesh(smokeGeo, smokeMat);
      smk.visible = false;
      smokeGroup.add(smk);
      smokePool.push({ mesh: smk, active: false, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    scene.add(smokeGroup);
    smokePoolRef.current = smokePool;

    // Fire & Crash Particles Pool (For 70% violent explosion)
    const fireGroup = new THREE.Group();
    const fireGeo = new THREE.DodecahedronGeometry(0.4, 1);
    const firePool: FireParticle[] = [];

    for (let i = 0; i < 28; i++) {
      const fireMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#f97316' : '#ef4444',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const fMesh = new THREE.Mesh(fireGeo, fireMat);
      fMesh.visible = false;
      fireGroup.add(fMesh);
      firePool.push({ mesh: fMesh, active: false, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    scene.add(fireGroup);
    firePoolRef.current = firePool;

    // Clouds
    const cloudsGroup = new THREE.Group();
    const cloudGeo = new THREE.DodecahedronGeometry(5, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#111827',
      roughness: 0.9,
      transparent: true,
      opacity: 0.4,
    });

    for (let i = 0; i < 35; i++) {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 140,
        (Math.random() - 0.5) * 35 - 12,
        -Math.random() * 550
      );
      const scale = 0.8 + Math.random() * 2.2;
      cloud.scale.set(scale, scale * 0.55, scale);
      cloudsGroup.add(cloud);
    }
    scene.add(cloudsGroup);

    // ==========================================
    // 7. RUNWAY + NEON EMERALD LANDING ZONE (30%)
    // ==========================================
    const runwayGroup = new THREE.Group();

    // Main Runway Tarmac (from z: +60 down to -460, length 520, width 18)
    const runwayMat = new THREE.MeshStandardMaterial({ color: '#070a12', roughness: 0.85 });
    const runwayGeo = new THREE.BoxGeometry(18, 0.4, 520);
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, -3.2, -200);
    runwayGroup.add(runway);

    // Outer Dirt/Rough ground borders
    const groundMat = new THREE.MeshStandardMaterial({ color: '#030509', roughness: 0.95 });
    const groundLeftGeo = new THREE.BoxGeometry(40, 0.35, 520);
    const groundLeft = new THREE.Mesh(groundLeftGeo, groundMat);
    groundLeft.position.set(-29, -3.25, -200);
    runwayGroup.add(groundLeft);
    const groundRight = new THREE.Mesh(groundLeftGeo, groundMat);
    groundRight.position.set(29, -3.25, -200);
    runwayGroup.add(groundRight);

    // Takeoff/Cruise Center Dash lines (Blue)
    const lineMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    for (let z = 50; z > -310; z -= 18) {
      const dashGeo = new THREE.BoxGeometry(0.8, 0.05, 8);
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.position.set(0, -2.95, z);
      runwayGroup.add(dash);
    }

    // ----------------------------------------------------
    // DESIGNATED LANDING ZONE (z: -320 to -420) [30% CHANCE]
    // ----------------------------------------------------
    const emeraldMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      blending: THREE.AdditiveBlending,
    });
    const brightEmeraldMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#059669',
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    // Landing Zone Laser Boundary Rails (Left & Right Glowing Beams)
    const laserRailGeo = new THREE.CylinderGeometry(0.18, 0.18, 100, 8);
    laserRailGeo.rotateX(Math.PI / 2);

    const leftLaserRail = new THREE.Mesh(laserRailGeo, emeraldMat);
    leftLaserRail.position.set(-8.5, -2.85, -370);
    runwayGroup.add(leftLaserRail);

    const rightLaserRail = new THREE.Mesh(laserRailGeo, emeraldMat);
    rightLaserRail.position.set(8.5, -2.85, -370);
    runwayGroup.add(rightLaserRail);

    // Entry & Exit Threshold Laser Cross-Beams
    const thresholdGeo = new THREE.CylinderGeometry(0.2, 0.2, 17.2, 8);
    thresholdGeo.rotateZ(Math.PI / 2);

    const entryThreshold = new THREE.Mesh(thresholdGeo, emeraldMat);
    entryThreshold.position.set(0, -2.85, -320);
    runwayGroup.add(entryThreshold);

    const exitThreshold = new THREE.Mesh(thresholdGeo, emeraldMat);
    exitThreshold.position.set(0, -2.85, -420);
    runwayGroup.add(exitThreshold);

    // 4 Neon Emerald Guide Pylons at the corners of the landing box
    const pylonGeo = new THREE.CylinderGeometry(0.3, 0.35, 3.5, 8);
    const beaconLightGeo = new THREE.CylinderGeometry(0.08, 0.4, 25, 8); // Light shaft upward
    const beaconLightMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
    });

    const pylonCoords = [
      [-8.5, -320],
      [8.5, -320],
      [-8.5, -420],
      [8.5, -420],
    ];

    pylonCoords.forEach(([px, pz]) => {
      const pylon = new THREE.Mesh(pylonGeo, brightEmeraldMat);
      pylon.position.set(px, -1.3, pz);
      runwayGroup.add(pylon);

      const shaft = new THREE.Mesh(beaconLightGeo, beaconLightMat);
      shaft.position.set(px, 11, pz);
      runwayGroup.add(shaft);
    });

    // Touchdown Target Crossbars & Emerald Chevrons on Tarmac
    for (let z = -335; z > -410; z -= 16) {
      // Emerald Center Dash
      const dashGeo = new THREE.BoxGeometry(1.2, 0.06, 9);
      const dash = new THREE.Mesh(dashGeo, emeraldMat);
      dash.position.set(0, -2.94, z);
      runwayGroup.add(dash);

      // Left & Right Touchdown Brackets
      const bracketGeo = new THREE.BoxGeometry(3.5, 0.05, 0.9);
      const bLeft = new THREE.Mesh(bracketGeo, emeraldMat);
      bLeft.position.set(-4.5, -2.94, z);
      runwayGroup.add(bLeft);

      const bRight = new THREE.Mesh(bracketGeo, emeraldMat);
      bRight.position.set(4.5, -2.94, z);
      runwayGroup.add(bRight);
    }

    scene.add(runwayGroup);

    // Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (rendererRef.current && mountRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, [planeSkin]);

  // Smoke Burst trigger for obstacles
  const triggerSmokeBurst = (origin: THREE.Vector3) => {
    let triggered = 0;
    smokePoolRef.current.forEach((p) => {
      if (!p.active && triggered < 6) {
        p.active = true;
        p.life = 1.0;
        p.mesh.position.set(
          origin.x + (Math.random() - 0.5) * 1.5,
          origin.y + (Math.random() - 0.5) * 1.0,
          origin.z + 1.0 + Math.random() * 2.0
        );
        p.vx = (Math.random() - 0.5) * 0.2;
        p.vy = (Math.random() - 0.5) * 0.2 + 0.1;
        p.vz = 0.35 + Math.random() * 0.3;
        p.mesh.scale.set(0.6, 0.6, 0.6);
        p.mesh.visible = true;
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.8;
        triggered++;
      }
    });
  };

  // Catastrophic Crash Explosion (70% failure case)
  const triggerCrashExplosion = (crashPos: THREE.Vector3) => {
    shakeIntensityRef.current = 0.85;

    // Trigger Fire Fireball
    firePoolRef.current.forEach((fp) => {
      fp.active = true;
      fp.life = 1.0;
      fp.mesh.position.set(
        crashPos.x + (Math.random() - 0.5) * 2.5,
        crashPos.y + Math.random() * 1.5,
        crashPos.z + (Math.random() - 0.5) * 3.0
      );
      fp.vx = (Math.random() - 0.5) * 0.45;
      fp.vy = 0.2 + Math.random() * 0.55;
      fp.vz = (Math.random() - 0.5) * 0.45;
      fp.mesh.scale.set(0.8, 0.8, 0.8);
      fp.mesh.visible = true;
      (fp.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
    });

    // Trigger Dense Black Smoke
    smokePoolRef.current.forEach((sp) => {
      sp.active = true;
      sp.life = 1.2;
      sp.mesh.position.set(
        crashPos.x + (Math.random() - 0.5) * 3.0,
        crashPos.y + Math.random() * 1.0,
        crashPos.z + (Math.random() - 0.5) * 3.0
      );
      sp.vx = (Math.random() - 0.5) * 0.3;
      sp.vy = 0.25 + Math.random() * 0.4;
      sp.vz = (Math.random() - 0.5) * 0.3;
      sp.mesh.scale.set(1.2, 1.2, 1.2);
      sp.mesh.visible = true;
      (sp.mesh.material as THREE.MeshStandardMaterial).opacity = 0.9;
    });
  };

  // Sync Obstacles (Rings & Rockets) in 3D Space
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    obstaclesMeshMap.current.forEach((mesh) => scene.remove(mesh));
    obstaclesMeshMap.current.clear();
    triggeredObstacles.current.clear();

    obstacles.forEach((obs) => {
      if (obs.type === 'ring') {
        const ringGroup = new THREE.Group();
        const torusGeo = new THREE.TorusGeometry(3.6, 0.35, 16, 40);
        const torusMat = new THREE.MeshStandardMaterial({
          color: '#06b6d4',
          emissive: '#0891b2',
          emissiveIntensity: 1.2,
          roughness: 0.2,
          metalness: 0.8,
        });
        const torus = new THREE.Mesh(torusGeo, torusMat);
        ringGroup.add(torus);

        const haloGeo = new THREE.RingGeometry(3.3, 4.2, 32);
        const haloMat = new THREE.MeshBasicMaterial({
          color: '#38bdf8',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4,
        });
        const halo = new THREE.Mesh(haloGeo, haloMat);
        ringGroup.add(halo);

        ringGroup.position.set(obs.position.x, obs.position.y, obs.position.z);
        scene.add(ringGroup);
        obstaclesMeshMap.current.set(obs.id, ringGroup);
      } else {
        const rocketGroup = new THREE.Group();
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 3.2, 12);
        bodyGeo.rotateX(Math.PI / 2);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#dc2626',
          emissiveIntensity: 0.8,
          roughness: 0.3,
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        rocketGroup.add(body);

        const noseGeo = new THREE.ConeGeometry(0.45, 1.2, 12);
        noseGeo.rotateX(-Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0, 2.0);
        rocketGroup.add(nose);

        const exhaustGeo = new THREE.ConeGeometry(0.35, 1.5, 10);
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaustMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
        const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
        exhaust.position.set(0, 0, -2.0);
        rocketGroup.add(exhaust);

        rocketGroup.position.set(obs.position.x, obs.position.y, obs.position.z);
        scene.add(rocketGroup);
        obstaclesMeshMap.current.set(obs.id, rocketGroup);
      }
    });
  }, [obstacles]);

  // =========================================================================
  // CONTINUOUS 60/120 FPS RAF LOOP - PURE PERFORMANCE.NOW() DELTA-TIME
  // Zero Stutter: Does NOT restart on state updates!
  // =========================================================================
  useEffect(() => {
    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const plane = planeGroupRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;

      if (!plane || !camera || !renderer || !scene) {
        animFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const currentPhase = phaseRef.current;
      const isLandSuccess = landingSuccessRef.current;
      const curMultiplier = multiplierRef.current;

      // Calculate continuous precise millisecond delta
      const now = performance.now();
      const dt = flightStartTimeRef.current !== null ? Math.max(0, now - flightStartTimeRef.current) : 0;

      // -------------------------------------------------------------
      // 1. FLIGHT TRAJECTORY & SMOOTH INTERPOLATION
      // -------------------------------------------------------------
      if (currentPhase === 'idle') {
        plane.position.set(0, -2.4, 0);
        plane.rotation.set(0, 0, 0);
      } else if (currentPhase === 'takeoff' || dt < 1500) {
        const t = Math.min(1, dt / 1500);
        // Smooth hermite cubic roll & lift
        const smoothT = t * t * (3 - 2 * t);
        plane.position.z = -smoothT * 40;
        plane.position.y = -2.4 + smoothT * 7.0;
        plane.position.x = 0;
        plane.rotation.x = -Math.sin(t * Math.PI * 0.5) * 0.22; // pitch up
        plane.rotation.z = 0;
        plane.rotation.y = 0;
      } else if (currentPhase === 'flying' || (dt >= 1500 && dt < 6000)) {
        // Cruising segment: dt 1500 -> 6000 (4500ms)
        const fT = Math.min(1, Math.max(0, (dt - 1500) / 4500));
        plane.position.z = -40 - fT * 280; // Moves towards landing threshold -320

        // Smooth bank waves
        const waveY = Math.sin(fT * Math.PI * 5) * 2.2;
        const waveX = Math.sin(fT * Math.PI * 3.5) * 3.5;
        plane.position.y = 7.0 + waveY;
        plane.position.x = waveX;

        plane.rotation.z = -Math.cos(fT * Math.PI * 3.5) * 0.32;
        plane.rotation.x = -0.04 + Math.sin(fT * Math.PI * 4) * 0.06;
        plane.rotation.y = 0;
      } else {
        // -----------------------------------------------------------
        // LANDING OR RESULT PHASE (dt 6000 -> 8000+)
        // 30% CHANCE SAFE TOUCHDOWN IN EMERALD ZONE
        // 70% CHANCE SUDDEN WIND-SHEER VEER & CATASTROPHIC CRASH
        // -----------------------------------------------------------
        const lT = Math.min(1, Math.max(0, (dt - 6000) / 2000));

        if (isLandSuccess) {
          // --- 30% CASE: PERFECT TOUCHDOWN IN EMERALD ZONE (-320 to -420) ---
          plane.position.z = -320 - lT * 85; // smoothly glides deep into green zone (-320..-405)

          // Align smoothly to center strip
          plane.position.x = plane.position.x * (1 - Math.min(1, lT * 1.8));

          // Controlled descent profile
          if (lT < 0.6) {
            // Approach descent
            const glideT = lT / 0.6;
            plane.position.y = 7.0 * (1 - glideT) + (-2.35) * glideT;
            plane.rotation.x = (1 - glideT) * 0.14; // gentle nose flare
            plane.rotation.z = plane.rotation.z * (1 - glideT);
          } else {
            // Touchdown & roll along green laser strip
            plane.position.y = -2.35;
            plane.rotation.x = 0;
            plane.rotation.z = 0;
          }
        } else {
          // --- 70% CASE: SEVERE TURBULENCE, DRIFT OFF-RUNWAY & CRASH ---
          plane.position.z = -320 - lT * 70;

          if (lT < 0.3) {
            // Initial violent wind gust knocks plane sideways
            const gustT = lT / 0.3;
            plane.position.x += gustT * 0.18;
            plane.rotation.z = -gustT * 0.85; // violent roll (~48 deg tilt)
            plane.rotation.x = 0.08 + gustT * 0.12;
            plane.position.y = 7.0 - gustT * 5.0;
          } else {
            // Crashes into rough ground at x ~ 10.5 (off-runway border is 9.0)
            const crashT = Math.min(1, (lT - 0.3) / 0.4);
            plane.position.x = 5.4 + crashT * 5.8; // veers to 11.2 (off runway!)
            plane.position.y = Math.max(-2.55, 2.0 - crashT * 4.55);
            plane.rotation.z = -0.85;
            plane.rotation.x = 0.25;

            // Trigger crash explosion once
            if (!crashTriggeredRef.current) {
              crashTriggeredRef.current = true;
              triggerCrashExplosion(plane.position);
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 2. OBSTACLES (RINGS & ROCKETS) ANIMATION & DETECTION
      // -------------------------------------------------------------
      obstaclesRef.current.forEach((obs) => {
        const mesh = obstaclesMeshMap.current.get(obs.id);
        if (!mesh) return;

        if (obs.type === 'ring') {
          mesh.rotation.z += 0.025;
        } else {
          mesh.position.z += 0.7; // missile zooms forward
        }

        const distZ = Math.abs(plane.position.z - mesh.position.z);
        if (distZ < 6.5 && !triggeredObstacles.current.has(obs.id)) {
          triggeredObstacles.current.add(obs.id);

          if (obs.type === 'ring') {
            fovKickRef.current = 8.0;
          } else {
            shakeIntensityRef.current = 0.5;
            triggerSmokeBurst(plane.position);
          }

          if (onHitRef.current) {
            onHitRef.current(obs.id, obs.type);
          }
        }
      });

      // -------------------------------------------------------------
      // 3. AFTERBURNER FLAMES & SPEED DYNAMICS
      // -------------------------------------------------------------
      const leftFlame = leftFlameGroupRef.current;
      const rightFlame = rightFlameGroupRef.current;
      if (leftFlame && rightFlame) {
        if (currentPhase === 'idle') {
          leftFlame.visible = false;
          rightFlame.visible = false;
        } else if (currentPhase === 'landing' || currentPhase === 'result') {
          // Throttled down or off during landing/crash
          if (!isLandSuccess && dt >= 6600) {
            leftFlame.visible = false;
            rightFlame.visible = false;
          } else {
            leftFlame.visible = true;
            rightFlame.visible = true;
            leftFlame.scale.set(0.4, 0.4, 0.5);
            rightFlame.scale.set(0.4, 0.4, 0.5);
          }
        } else {
          leftFlame.visible = true;
          rightFlame.visible = true;
          const flicker = 1 + Math.sin(now * 0.035) * 0.12;
          const speedFactor = currentPhase === 'flying' ? Math.min(2.2, 1.2 + (curMultiplier - 1) * 0.16) : 1.0;
          const sZ = flicker * speedFactor;
          const sXY = flicker * (currentPhase === 'flying' ? 1.15 : 0.85);

          leftFlame.scale.set(sXY, sXY, sZ);
          rightFlame.scale.set(sXY, sXY, sZ);
        }
      }

      // -------------------------------------------------------------
      // 4. WINGTIP RIBBON TRAILS
      // -------------------------------------------------------------
      if (
        (currentPhase === 'takeoff' || currentPhase === 'flying' || (currentPhase === 'landing' && isLandSuccess)) &&
        leftTrailGeoRef.current &&
        rightTrailGeoRef.current
      ) {
        plane.updateMatrixWorld();
        const leftTipWorld = new THREE.Vector3(-3.2, 0, 0.3).applyMatrix4(plane.matrixWorld);
        const rightTipWorld = new THREE.Vector3(3.2, 0, 0.3).applyMatrix4(plane.matrixWorld);

        leftTrailHistory.current.unshift(leftTipWorld);
        rightTrailHistory.current.unshift(rightTipWorld);

        const maxPoints = 26;
        if (leftTrailHistory.current.length > maxPoints) leftTrailHistory.current.pop();
        if (rightTrailHistory.current.length > maxPoints) rightTrailHistory.current.pop();

        leftTrailGeoRef.current.setFromPoints(leftTrailHistory.current);
        rightTrailGeoRef.current.setFromPoints(rightTrailHistory.current);

        if (leftTrailLineRef.current) leftTrailLineRef.current.visible = true;
        if (rightTrailLineRef.current) rightTrailLineRef.current.visible = true;
      } else {
        if (leftTrailLineRef.current) leftTrailLineRef.current.visible = false;
        if (rightTrailLineRef.current) rightTrailLineRef.current.visible = false;
      }

      // -------------------------------------------------------------
      // 5. UPDATE PARTICLES (COLLISION SMOKE + CRASH EXPLOSION)
      // -------------------------------------------------------------
      smokePoolRef.current.forEach((p) => {
        if (!p.active) return;
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life -= 0.02;
        const s = 0.8 + (1.2 - p.life) * 2.2;
        p.mesh.scale.set(s, s, s);
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.life * 0.75);
        if (p.life <= 0) {
          p.active = false;
          p.mesh.visible = false;
        }
      });

      firePoolRef.current.forEach((fp) => {
        if (!fp.active) return;
        fp.mesh.position.x += fp.vx;
        fp.mesh.position.y += fp.vy;
        fp.mesh.position.z += fp.vz;
        fp.life -= 0.025;
        const s = 0.6 + (1 - fp.life) * 2.6;
        fp.mesh.scale.set(s, s, s);
        (fp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, fp.life * 0.95);
        if (fp.life <= 0) {
          fp.active = false;
          fp.mesh.visible = false;
        }
      });

      // -------------------------------------------------------------
      // 6. CINEMATIC CAMERA CHASE & SHAKE
      // -------------------------------------------------------------
      fovKickRef.current *= 0.92;
      camera.fov = 55 + fovKickRef.current + Math.min(6, (curMultiplier - 1) * 1.1);
      camera.updateProjectionMatrix();

      // Wing shudder on shake
      if (shakeIntensityRef.current > 0.05) {
        plane.rotation.z += (Math.random() - 0.5) * shakeIntensityRef.current * 0.25;
      }

      // Camera Follow Target
      const targetCamX = plane.position.x * 0.4;
      const targetCamY = plane.position.y + 3.2;
      const targetCamZ = plane.position.z + 10.2;

      camera.position.x += (targetCamX - camera.position.x) * 0.12;
      camera.position.y += (targetCamY - camera.position.y) * 0.12;
      camera.position.z += (targetCamZ - camera.position.z) * 0.16;

      if (shakeIntensityRef.current > 0.01) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensityRef.current;
        camera.position.y += (Math.random() - 0.5) * shakeIntensityRef.current;
        shakeIntensityRef.current *= 0.88;
      }

      camera.lookAt(
        plane.position.x * 0.75,
        plane.position.y + 0.4,
        plane.position.z - 8.0
      );

      // Render Final 3D Frame
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, []); // Run once on mount! Decoupled from all state updates for zero stutter!

  // Calculated Speedometer
  const isHighSpeed = flightPhase === 'flying' && multiplier >= 2.5;
  const speedKmh =
    flightPhase === 'idle'
      ? 0
      : Math.round(450 * Math.max(1, (multiplier ?? 1) * 0.85));

  return (
    <div className="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black">
      <div ref={mountRef} className="w-full h-full" />

      {/* Atmospheric Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-radial-vignette opacity-40" />

      {/* Cinematic High-Speed Radial Tunnel Overlay (Multiplier >= 2.5x) */}
      {isHighSpeed && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-500"
          style={{ opacity: Math.min(0.85, (multiplier - 2.0) * 0.3) }}
        >
          <svg className="w-full h-full animate-[spin_8s_linear_infinite]" viewBox="0 0 200 200">
            <defs>
              <radialGradient id="speedGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0" />
                <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.08" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.38" />
              </radialGradient>
            </defs>
            <rect width="200" height="200" fill="url(#speedGlow)" />
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 360) / 24;
              const rad = (angle * Math.PI) / 180;
              const x1 = 100 + Math.cos(rad) * 45;
              const y1 = 100 + Math.sin(rad) * 45;
              const x2 = 100 + Math.cos(rad) * 120;
              const y2 = 100 + Math.sin(rad) * 120;
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#38bdf8"
                  strokeWidth={i % 3 === 0 ? '1.5' : '0.8'}
                  strokeOpacity={i % 2 === 0 ? 0.7 : 0.35}
                  strokeDasharray={i % 2 === 0 ? '6 4' : '3 6'}
                />
              );
            })}
          </svg>
        </div>
      )}

      {/* HUD Speed Lines / Speedometer Badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono font-bold text-sky-400">
        <span className={`w-2 h-2 rounded-full ${isHighSpeed ? 'bg-amber-400 animate-ping' : 'bg-sky-400 animate-ping'}`} />
        <span>
          {isHighSpeed
            ? `⚡ СВЕРХЗВУК (МАХ ${(1.1 + multiplier * 0.3).toFixed(1)})`
            : `3D СКОРОСТЬ: ${speedKmh} КМ/Ч`}
        </span>
      </div>

      {/* HUD Landing Zone Status Indicator */}
      <div className="absolute bottom-3 left-3 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 bg-black/75 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono font-bold">
        {flightPhase === 'landing' || flightPhase === 'result' ? (
          landingSuccess ? (
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              🎯 ЗОНА ПОСАДКИ: ЗАХВАТ [30%]
            </span>
          ) : (
            <span className="text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
              ⚠️ СНОС ВЕТРОМ ВНЕ ЗОНЫ [70%]
            </span>
          )
        ) : (
          <span className="text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            ЗОНА ПОСАДКИ (ШАНС 30%)
          </span>
        )}
      </div>
    </div>
  );
};
