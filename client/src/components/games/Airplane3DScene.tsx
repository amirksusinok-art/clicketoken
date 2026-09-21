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

export const Airplane3DScene: React.FC<Airplane3DSceneProps> = ({
  flightPhase,
  elapsedMs,
  obstacles,
  landingSuccess,
  multiplier = 1.0,
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
  const cloudsGroupRef = useRef<THREE.Group | null>(null);
  const runwayGroupRef = useRef<THREE.Group | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Dynamic Camera & FX refs
  const fovKickRef = useRef<number>(0);
  const shakeIntensityRef = useRef<number>(0);
  const smokePoolRef = useRef<SmokeParticle[]>([]);
  const smokeGroupRef = useRef<THREE.Group | null>(null);

  // Contrail Ribbon Trails
  const leftTrailGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const rightTrailGeoRef = useRef<THREE.BufferGeometry | null>(null);
  const leftTrailLineRef = useRef<THREE.Line | null>(null);
  const rightTrailLineRef = useRef<THREE.Line | null>(null);
  const leftTrailHistory = useRef<THREE.Vector3[]>([]);
  const rightTrailHistory = useRef<THREE.Vector3[]>([]);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene setup
    const width = mountRef.current.clientWidth || 320;
    const height = mountRef.current.clientHeight || 280;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#070b14');
    scene.fog = new THREE.FogExp2('#070b14', 0.0055);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight('#38bdf8', 2.2);
    sunLight.position.set(20, 40, 30);
    scene.add(sunLight);

    const bottomGlow = new THREE.DirectionalLight('#a855f7', 1.2);
    bottomGlow.position.set(-20, -20, -10);
    scene.add(bottomGlow);

    // 3. Build Airplane 3D Model
    const planeGroup = new THREE.Group();

    // Fuselage
    const fuselageGeo = new THREE.ConeGeometry(1.0, 4.8, 16);
    fuselageGeo.rotateX(Math.PI / 2);
    const fuselageMat = new THREE.MeshStandardMaterial({
      color: '#0284c7',
      roughness: 0.25,
      metalness: 0.85,
    });
    const fuselage = new THREE.Mesh(fuselageGeo, fuselageMat);
    planeGroup.add(fuselage);

    // Cockpit canopy
    const cockpitGeo = new THREE.SphereGeometry(0.5, 16, 12);
    cockpitGeo.scale(0.8, 0.6, 2.0);
    const cockpitMat = new THREE.MeshPhysicalMaterial({
      color: '#38bdf8',
      transmission: 0.65,
      opacity: 0.9,
      transparent: true,
      roughness: 0.1,
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.5, -0.4);
    planeGroup.add(cockpit);

    // Main Delta Wings
    const wingGeo = new THREE.BoxGeometry(6.5, 0.12, 2.2);
    const wingMat = new THREE.MeshStandardMaterial({
      color: '#0369a1',
      roughness: 0.35,
      metalness: 0.75,
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0, 0.3);
    planeGroup.add(wings);

    // Vertical Stabilizer (Fin)
    const finGeo = new THREE.BoxGeometry(0.12, 1.4, 1.2);
    const fin = new THREE.Mesh(finGeo, wingMat);
    fin.position.set(0, 0.8, 1.4);
    planeGroup.add(fin);

    // Thruster nozzles
    const engineMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.4,
      metalness: 0.9,
    });
    const thrusterGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.7, 14);
    thrusterGeo.rotateX(Math.PI / 2);

    const leftThruster = new THREE.Mesh(thrusterGeo, engineMat);
    leftThruster.position.set(-0.65, 0, 2.1);
    const rightThruster = new THREE.Mesh(thrusterGeo, engineMat);
    rightThruster.position.set(0.65, 0, 2.1);
    planeGroup.add(leftThruster);
    planeGroup.add(rightThruster);

    // Afterburners (Pulsating Flame Cones)
    const createFlameGroup = () => {
      const group = new THREE.Group();

      // Outer plume (cyan-blue shockwave)
      const plumeGeo = new THREE.ConeGeometry(0.38, 2.4, 12);
      plumeGeo.rotateX(Math.PI / 2);
      const plumeMat = new THREE.MeshBasicMaterial({
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
      });
      const plume = new THREE.Mesh(plumeGeo, plumeMat);
      plume.position.set(0, 0, 1.2);
      group.add(plume);

      // Inner flame core (white-hot)
      const coreGeo = new THREE.ConeGeometry(0.2, 1.5, 10);
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

    // 4. Ribbon Trails (Wingtip Contrails)
    const trailMat = new THREE.LineBasicMaterial({
      color: '#38bdf8',
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

    // 5. Collision Smoke Particles Pool
    const smokeGroup = new THREE.Group();
    const smokeGeo = new THREE.DodecahedronGeometry(0.5, 1);
    const smokePool: SmokeParticle[] = [];

    for (let i = 0; i < 16; i++) {
      const smokeMat = new THREE.MeshStandardMaterial({
        color: '#1e293b',
        roughness: 0.9,
        transparent: true,
        opacity: 0,
      });
      const smk = new THREE.Mesh(smokeGeo, smokeMat);
      smk.visible = false;
      smokeGroup.add(smk);
      smokePool.push({
        mesh: smk,
        active: false,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
      });
    }
    scene.add(smokeGroup);
    smokeGroupRef.current = smokeGroup;
    smokePoolRef.current = smokePool;

    // 6. Cloud clusters
    const cloudsGroup = new THREE.Group();
    const cloudGeo = new THREE.DodecahedronGeometry(5, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#1e293b',
      roughness: 0.9,
      transparent: true,
      opacity: 0.45,
    });

    for (let i = 0; i < 35; i++) {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      cloud.position.set(
        (Math.random() - 0.5) * 120,
        (Math.random() - 0.5) * 30 - 15,
        -Math.random() * 500
      );
      const scale = 0.8 + Math.random() * 2.0;
      cloud.scale.set(scale, scale * 0.6, scale);
      cloudsGroup.add(cloud);
    }
    scene.add(cloudsGroup);
    cloudsGroupRef.current = cloudsGroup;

    // 7. Runway for takeoff and landing
    const runwayGroup = new THREE.Group();
    const runwayMat = new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.8 });
    const runwayGeo = new THREE.BoxGeometry(16, 0.4, 400);
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.position.set(0, -3.2, -150);
    runwayGroup.add(runway);

    // Runway Center Dash lines
    const lineMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    for (let z = 30; z > -350; z -= 18) {
      const dashGeo = new THREE.BoxGeometry(0.8, 0.05, 8);
      const dash = new THREE.Mesh(dashGeo, lineMat);
      dash.position.set(0, -2.95, z);
      runwayGroup.add(dash);
    }
    scene.add(runwayGroup);
    runwayGroupRef.current = runwayGroup;

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
  }, []);

  // Trigger smoke burst upon rocket collision
  const triggerSmokeBurst = (origin: THREE.Vector3) => {
    let triggered = 0;
    smokePoolRef.current.forEach((p) => {
      if (!p.active && triggered < 8) {
        p.active = true;
        p.life = 1.0;
        p.mesh.position.set(
          origin.x + (Math.random() - 0.5) * 1.5,
          origin.y + (Math.random() - 0.5) * 1.0,
          origin.z + 1.0 + Math.random() * 2.0
        );
        p.vx = (Math.random() - 0.5) * 0.25;
        p.vy = (Math.random() - 0.5) * 0.25 + 0.1;
        p.vz = 0.4 + Math.random() * 0.4; // drift backward
        p.mesh.scale.set(0.6, 0.6, 0.6);
        p.mesh.visible = true;
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.8;
        triggered++;
      }
    });
  };

  // Sync Obstacles (Rings & Rockets) in 3D Space
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    // Clean old obstacles
    obstaclesMeshMap.current.forEach((mesh) => scene.remove(mesh));
    obstaclesMeshMap.current.clear();
    triggeredObstacles.current.clear();

    // Create 3D Meshes for each obstacle
    obstacles.forEach((obs) => {
      if (obs.type === 'ring') {
        // Glowing 3D Torus Ring
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

        // Outer glow halo
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
        // 3D Rocket Missile
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

        // Rocket nose cone
        const noseGeo = new THREE.ConeGeometry(0.45, 1.2, 12);
        noseGeo.rotateX(-Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, bodyMat);
        nose.position.set(0, 0, 2.0);
        rocketGroup.add(nose);

        // Fiery exhaust light
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

  // Main 60fps Render Loop & Smooth Interpolation
  useEffect(() => {
    const renderLoop = () => {
      const plane = planeGroupRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      const scene = sceneRef.current;

      if (!plane || !camera || !renderer || !scene) return;

      // 1. Airplane Position & Flight Path
      if (flightPhase === 'idle') {
        plane.position.set(0, -2.4, 0);
        plane.rotation.set(0, 0, 0);
      } else if (flightPhase === 'takeoff') {
        const t = Math.min(1, elapsedMs / 1500);
        // Roll forward on runway and pitch up
        plane.position.z = -t * 40;
        plane.position.y = -2.4 + t * 6.0;
        plane.rotation.x = -t * 0.25; // pitch up
      } else if (flightPhase === 'flying') {
        // Dynamic cruising altitude
        const flightTime = (elapsedMs - 1500) / 4500; // 0..1
        plane.position.z = -40 - flightTime * 300;

        // Subtle banking wave
        const waveY = Math.sin(flightTime * Math.PI * 4) * 2.5;
        const waveX = Math.cos(flightTime * Math.PI * 3) * 3.0;
        plane.position.y = 8 + waveY;
        plane.position.x = waveX;

        // Bank into turns
        plane.rotation.z = -Math.sin(flightTime * Math.PI * 3) * 0.35;
        plane.rotation.x = -0.05 + Math.sin(flightTime * Math.PI * 4) * 0.08;
      } else if (flightPhase === 'landing' || flightPhase === 'result') {
        const landTime = Math.min(1, (elapsedMs - 6000) / 2000);
        plane.position.z = -340 - landTime * 50;

        if (landingSuccess) {
          // Smooth flare and touchdown on runway
          plane.position.y = Math.max(-2.4, 8 - landTime * 10.4);
          plane.position.x = plane.position.x * (1 - landTime);
          plane.rotation.x = (1 - landTime) * 0.15; // flare nose up then level
          plane.rotation.z = 0;
        } else {
          // Crash angle / descent
          plane.position.y = Math.max(-2.4, 8 - landTime * 12);
          plane.rotation.z += 0.05;
          plane.rotation.x += 0.04;
        }
      }

      // 2. Obstacle Animations & Collision Detection
      obstacles.forEach((obs) => {
        const mesh = obstaclesMeshMap.current.get(obs.id);
        if (!mesh) return;

        if (obs.type === 'ring') {
          // Slowly rotate ring
          mesh.rotation.z += 0.02;
        } else {
          // Rocket zooms towards plane
          mesh.position.z += 0.6;
        }

        // Check if plane has crossed the obstacle Z
        const distZ = Math.abs(plane.position.z - mesh.position.z);
        if (distZ < 6.0 && !triggeredObstacles.current.has(obs.id)) {
          triggeredObstacles.current.add(obs.id);

          // Speed punch on ring pass or collision shake on rocket
          if (obs.type === 'ring') {
            fovKickRef.current = 8.5; // kick camera FOV up
          } else {
            shakeIntensityRef.current = 0.55; // camera shake & wobble
            triggerSmokeBurst(plane.position);
          }

          if (onObstacleHit) {
            onObstacleHit(obs.id, obs.type);
          }
        }
      });

      // 3. Afterburners Animation & Flicker
      const leftFlame = leftFlameGroupRef.current;
      const rightFlame = rightFlameGroupRef.current;
      if (leftFlame && rightFlame) {
        if (flightPhase === 'idle') {
          leftFlame.visible = false;
          rightFlame.visible = false;
        } else {
          leftFlame.visible = true;
          rightFlame.visible = true;

          const flicker = 1 + Math.sin(Date.now() * 0.05) * 0.15 + (Math.random() - 0.5) * 0.08;
          const speedMultiplierFactor = flightPhase === 'flying' ? Math.min(2.0, 1.2 + (multiplier - 1) * 0.15) : 1.0;
          const sZ = flicker * speedMultiplierFactor;
          const sXY = flicker * (flightPhase === 'flying' ? 1.15 : 0.85);

          leftFlame.scale.set(sXY, sXY, sZ);
          rightFlame.scale.set(sXY, sXY, sZ);
        }
      }

      // 4. Ribbon Trails (Wingtip Contrails)
      if (
        (flightPhase === 'takeoff' || flightPhase === 'flying' || flightPhase === 'landing') &&
        leftTrailGeoRef.current &&
        rightTrailGeoRef.current
      ) {
        plane.updateMatrixWorld();
        const leftTipWorld = new THREE.Vector3(-3.25, 0, 0.3).applyMatrix4(plane.matrixWorld);
        const rightTipWorld = new THREE.Vector3(3.25, 0, 0.3).applyMatrix4(plane.matrixWorld);

        leftTrailHistory.current.unshift(leftTipWorld);
        rightTrailHistory.current.unshift(rightTipWorld);

        const maxPoints = 28;
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

      // 5. Collision Smoke Particles Update
      smokePoolRef.current.forEach((p) => {
        if (!p.active) return;
        p.mesh.position.x += p.vx;
        p.mesh.position.y += p.vy;
        p.mesh.position.z += p.vz;
        p.life -= 0.025;
        const s = 0.8 + (1 - p.life) * 2.5;
        p.mesh.scale.set(s, s, s);
        (p.mesh.material as THREE.MeshStandardMaterial).opacity = Math.max(0, p.life * 0.7);
        if (p.life <= 0) {
          p.active = false;
          p.mesh.visible = false;
        }
      });

      // 6. Camera Dynamic FOV & Shake
      fovKickRef.current *= 0.9;
      camera.fov = 55 + fovKickRef.current + Math.min(6, (multiplier - 1) * 1.2);
      camera.updateProjectionMatrix();

      // Plane wing wobble on shake
      if (shakeIntensityRef.current > 0.05) {
        plane.rotation.z += (Math.random() - 0.5) * shakeIntensityRef.current * 0.3;
      }

      // Smooth Camera Follow
      const targetCamX = plane.position.x * 0.45;
      const targetCamY = plane.position.y + 3.2;
      const targetCamZ = plane.position.z + 10.5;

      camera.position.x += (targetCamX - camera.position.x) * 0.1;
      camera.position.y += (targetCamY - camera.position.y) * 0.1;
      camera.position.z += (targetCamZ - camera.position.z) * 0.15;

      // Apply camera shake jitter
      if (shakeIntensityRef.current > 0.01) {
        camera.position.x += (Math.random() - 0.5) * shakeIntensityRef.current;
        camera.position.y += (Math.random() - 0.5) * shakeIntensityRef.current;
        shakeIntensityRef.current *= 0.88;
      }

      camera.lookAt(
        plane.position.x * 0.8,
        plane.position.y + 0.5,
        plane.position.z - 8.0
      );

      // Render scene
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [flightPhase, elapsedMs, obstacles, landingSuccess, multiplier, onObstacleHit]);

  // Compute calculated speedometer values
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
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono font-bold text-sky-400">
        <span className={`w-2 h-2 rounded-full ${isHighSpeed ? 'bg-amber-400 animate-ping' : 'bg-sky-400 animate-ping'}`} />
        <span>
          {isHighSpeed
            ? `⚡ СВЕРХЗВУК (МАХ ${(1.1 + multiplier * 0.3).toFixed(1)})`
            : `3D СКОРОСТЬ: ${speedKmh} КМ/Ч`}
        </span>
      </div>
    </div>
  );
};
