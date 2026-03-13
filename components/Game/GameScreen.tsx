import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { ShoppingBag } from 'lucide-react';
import { heroList, HeroData } from '../../data/heroList';

interface GameScreenProps {
  selectedHero: HeroData;
  onExit?: () => void;
}

type Team = 'radiant' | 'dire';

type UnitType = 'hero' | 'creep' | 'tower' | 'ancient' | 'fountain' | 'projectile' | 'hook';

interface GameUnit {
  id: string;
  type: UnitType;
  team: Team;
  mesh: THREE.Object3D;
  radius: number;
  hp: number;
  maxHp: number;
  damage: number;
  armor: number;
  range: number;
  speed: number;
  targetId?: string;
  moveTarget?: THREE.Vector3;
  attackCooldown: number;
  attackTimer: number;
  isBuilding?: boolean;
  status?: {
    tauntedBy?: string;
    spinUntil?: number;
    slowUntil?: number;
    bonusArmorUntil?: number;
  };
}

interface Projectile {
  id: string;
  team: Team;
  mesh: THREE.Mesh;
  targetId: string;
  speed: number;
  damage: number;
  type: 'basic' | 'hook' | 'spell';
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  maxDistance: number;
  traveled: number;
  casterId: string;
  chain?: THREE.Line;
}

const SHOP_ITEMS = [
  { id: 'tango', name: 'Tango', cost: 90, stats: { maxHp: 100 } },
  { id: 'salve', name: 'Healing Salve', cost: 100, stats: { maxHp: 120 } },
  { id: 'boots', name: 'Boots', cost: 500, stats: { speed: 35 } },
  { id: 'desolator', name: 'Desolator', cost: 3500, stats: { damage: 50 } },
  { id: 'blade', name: 'Broadsword', cost: 1000, stats: { damage: 20 } },
  { id: 'robe', name: 'Robe', cost: 450, stats: { armor: 2 } },
];

const EDGE_PAN_DISTANCE = 40;
const MAP_SIZE = 6000;
const MAX_MANA = 400;

const GameScreen: React.FC<GameScreenProps> = ({ selectedHero, onExit }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    ground: THREE.Mesh;
    units: GameUnit[];
    projectiles: Projectile[];
    playerId: string;
    mouse: { x: number; y: number; inBounds: boolean };
    lastTime: number;
    gold: number;
    inventory: string[];
    backpack: string[];
    abilityCooldowns: Record<string, number>;
  } | null>(null);

  const [gold, setGold] = useState(600);
  const [inventory, setInventory] = useState<string[]>([]);
  const [backpack, setBackpack] = useState<string[]>([]);
  const [shopOpen, setShopOpen] = useState(false);
  const [victory, setVictory] = useState<null | Team>(null);
  const [heroStats, setHeroStats] = useState(selectedHero.stats);
  const [cooldownTick, setCooldownTick] = useState(0);
  const [playerSnapshot, setPlayerSnapshot] = useState({
    hp: selectedHero.stats.baseStr * 20,
    maxHp: selectedHero.stats.baseStr * 20,
    mana: MAX_MANA,
    maxMana: MAX_MANA,
  });

  const heroData = useMemo(() => selectedHero ?? heroList[0], [selectedHero]);

  useEffect(() => {
    const applied = { ...heroData.stats };
    [...inventory, ...backpack].forEach((itemId) => {
      const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
      if (!item) return;
      if (item.stats.damage) applied.damage += item.stats.damage;
      if (item.stats.speed) applied.speed += item.stats.speed;
      if (item.stats.maxHp) applied.baseStr += Math.floor(item.stats.maxHp / 20);
      if (item.stats.armor) applied.armor += item.stats.armor;
    });
    setHeroStats(applied);
  }, [inventory, backpack, heroData.stats]);

  useEffect(() => {
    if (!gameStateRef.current) return;
    gameStateRef.current.gold = gold;
    gameStateRef.current.inventory = inventory;
    gameStateRef.current.backpack = backpack;
  }, [gold, inventory, backpack]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCooldownTick((prev) => prev + 1);
    }, 200);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const state = gameStateRef.current;
      if (!state) return;
      const player = state.units.find((unit) => unit.id === state.playerId);
      if (!player) return;
      setPlayerSnapshot({
        hp: Math.max(player.hp, 0),
        maxHp: player.maxHp,
        mana: MAX_MANA,
        maxMana: MAX_MANA,
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!gameStateRef.current) return;
    const player = gameStateRef.current.units.find((unit) => unit.id === gameStateRef.current?.playerId);
    if (!player) return;
    const hpRatio = player.hp / player.maxHp;
    player.damage = heroStats.damage;
    player.armor = heroStats.armor;
    player.speed = heroStats.speed * 1.5;
    player.maxHp = heroStats.baseStr * 20;
    player.hp = Math.min(player.maxHp, player.maxHp * hpRatio);
  }, [heroStats]);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#0f1012', 400, 4000);

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 12000);
    camera.position.set(1200, 1200, 1200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffe6b3, 0.8);
    sun.position.set(1000, 1800, 500);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    scene.add(sun);

    const mapTexture = createMapTexture();
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, 1, 1),
      new THREE.MeshStandardMaterial({ map: mapTexture })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    spawnTrees(scene);

    const units: GameUnit[] = [];
    const projectiles: Projectile[] = [];

    const playerHero = createHeroUnit(heroData, 'radiant', new THREE.Vector3(-600, 0, -600));
    scene.add(playerHero.mesh);
    units.push(playerHero);

    const enemyHero = createHeroUnit(
      heroList.find((hero) => hero.id === 'pudge') ?? heroData,
      'dire',
      new THREE.Vector3(600, 0, 600)
    );
    scene.add(enemyHero.mesh);
    units.push(enemyHero);

    const radiantTower = createTower('radiant', new THREE.Vector3(-1200, 0, -1200));
    const direTower = createTower('dire', new THREE.Vector3(1200, 0, 1200));
    scene.add(radiantTower.mesh, direTower.mesh);
    units.push(radiantTower, direTower);

    const radiantAncient = createAncient('radiant', new THREE.Vector3(-2200, 0, -2200));
    const direAncient = createAncient('dire', new THREE.Vector3(2200, 0, 2200));
    scene.add(radiantAncient.mesh, direAncient.mesh);
    units.push(radiantAncient, direAncient);

    const fountain = createFountain('radiant', new THREE.Vector3(-1800, 0, -1800));
    scene.add(fountain.mesh);
    units.push(fountain);

    const mouse = { x: 0, y: 0, inBounds: true };

    gameStateRef.current = {
      scene,
      camera,
      renderer,
      ground,
      units,
      projectiles,
      playerId: playerHero.id,
      mouse,
      lastTime: performance.now(),
      gold,
      inventory,
      backpack,
      abilityCooldowns: { Q: 0, W: 0, E: 0, R: 0 },
    };

    const handleResize = () => {
      if (!gameStateRef.current) return;
      const { camera: cam, renderer: rend } = gameStateRef.current;
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
      rend.setSize(window.innerWidth, window.innerHeight);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!gameStateRef.current) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      gameStateRef.current.mouse.x = event.clientX - bounds.left;
      gameStateRef.current.mouse.y = event.clientY - bounds.top;
      gameStateRef.current.mouse.inBounds =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
    };

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!gameStateRef.current) return;
      const { camera: cam, scene: currentScene, units: currentUnits } = gameStateRef.current;
      const bounds = renderer.domElement.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, cam);
      const intersections = raycaster.intersectObjects(currentScene.children, true);
      const player = currentUnits.find((unit) => unit.id === gameStateRef.current?.playerId);
      if (!player) return;

      const hitUnit = intersections
        .map((hit) => currentUnits.find((unit) => unit.mesh === hit.object || unit.mesh.children.includes(hit.object)))
        .find(Boolean);

      if (hitUnit && hitUnit.team !== player.team) {
        player.targetId = hitUnit.id;
        player.moveTarget = undefined;
        return;
      }

      const groundHit = intersections.find((hit) => hit.object === ground);
      if (groundHit) {
        player.moveTarget = groundHit.point.clone();
        player.targetId = undefined;
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!gameStateRef.current) return;
      const { abilityCooldowns } = gameStateRef.current;
      const player = gameStateRef.current.units.find((unit) => unit.id === gameStateRef.current?.playerId);
      if (!player) return;
      const now = performance.now();

      if (event.key.toLowerCase() === 'q' && abilityCooldowns.Q <= now) {
        castPrimaryAbility(player, heroData, gameStateRef.current);
        abilityCooldowns.Q = now + 8000;
      }
      if (event.key.toLowerCase() === 'w' && abilityCooldowns.W <= now) {
        abilityCooldowns.W = now + 12000;
      }
      if (event.key.toLowerCase() === 'e' && abilityCooldowns.E <= now) {
        abilityCooldowns.E = now + 15000;
      }
      if (event.key.toLowerCase() === 'r' && abilityCooldowns.R <= now) {
        abilityCooldowns.R = now + 60000;
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    let animationId = 0;
    const loop = () => {
      if (!gameStateRef.current) return;
      const state = gameStateRef.current;
      const now = performance.now();
      const delta = Math.min((now - state.lastTime) / 1000, 0.05);
      state.lastTime = now;

      updateCamera(state, delta);
      updateUnits(state, delta, setVictory);
      updateProjectiles(state, delta);
      updateMinimap(state, minimapRef.current);

      state.renderer.render(state.scene, state.camera);
      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(animationId);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
      gameStateRef.current = null;
    };
  }, [heroData]);

  const handlePurchase = (itemId: string) => {
    const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
    if (!item || gold < item.cost) return;
    if (inventory.length < 6) {
      setInventory((prev) => [...prev, itemId]);
    } else if (backpack.length < 3) {
      setBackpack((prev) => [...prev, itemId]);
    } else {
      return;
    }
    setGold((prev) => prev - item.cost);
  };

  const currentHeroImage = heroData.image;
  const abilityCooldowns = gameStateRef.current?.abilityCooldowns ?? { Q: 0, W: 0, E: 0, R: 0 };
  const now = useMemo(() => performance.now(), [cooldownTick]);

  const abilities = heroData.abilities;

  return (
    <div ref={containerRef} className="relative h-screen w-screen overflow-hidden bg-[#08090d]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0f1012]/20 to-[#0f1012]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(194,60,42,0.17),transparent_35%),radial-gradient(circle_at_82%_70%,rgba(50,120,218,0.14),transparent_35%)]" />
      <div className="pointer-events-none absolute left-[-140px] top-10 h-80 w-80 rounded-full bg-[#c23c2a]/20 blur-[120px]" />
      <div className="pointer-events-none absolute bottom-[-120px] right-[-100px] h-[24rem] w-[24rem] rounded-full bg-[#2f63c9]/15 blur-[130px]" />

      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-6 pb-4 text-white">
        <div className="flex items-end gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-md border border-[#444b57] shadow-[0_12px_35px_rgba(0,0,0,0.55)]">
            <img src={currentHeroImage} alt={heroData.name} className="h-full w-full object-cover" />
          </div>
          <div className="space-y-3 rounded-lg border border-[#2a2d33] bg-[#090b10]/65 p-3 backdrop-blur-sm">
            <div className="font-[Cinzel] text-lg uppercase tracking-[0.3em] text-[#f7e7c0]">
              {heroData.name}
            </div>
            <div className="space-y-2">
              <div className="h-3 w-64 overflow-hidden rounded-full border border-[#2a2d33] bg-[#121419]">
                <div
                  className="h-full bg-gradient-to-r from-[#1d6b3a] to-[#4edb7c]"
                  style={{ width: `${(playerSnapshot.hp / playerSnapshot.maxHp) * 100}%` }}
                />
              </div>
              <div className="h-3 w-64 overflow-hidden rounded-full border border-[#2a2d33] bg-[#121419]">
                <div
                  className="h-full bg-gradient-to-r from-[#1a2f6b] to-[#3b74ff]"
                  style={{ width: `${(playerSnapshot.mana / playerSnapshot.maxMana) * 100}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2 text-xs uppercase tracking-[0.2em] text-[#9aa0a8]">
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                Damage
                <div className="text-base font-semibold text-white">{heroStats.damage}</div>
              </div>
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                Armor
                <div className="text-base font-semibold text-white">{heroStats.armor}</div>
              </div>
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                Speed
                <div className="text-base font-semibold text-white">{heroStats.speed}</div>
              </div>
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                STR
                <div className="text-base font-semibold text-white">{heroStats.baseStr}</div>
              </div>
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                AGI
                <div className="text-base font-semibold text-white">{heroStats.baseAgi}</div>
              </div>
              <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
                INT
                <div className="text-base font-semibold text-white">{heroStats.baseInt}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="grid grid-cols-4 gap-3 rounded-lg border border-[#2a2d33] bg-[#090b10]/65 p-3 backdrop-blur-sm">
            {abilities.map((ability, index) => {
              const key = ['Q', 'W', 'E', 'R'][index];
              const remaining = Math.max(0, Math.ceil((abilityCooldowns[key] - now) / 1000));
              return (
                <div
                  key={ability.name}
                  className="relative h-14 w-14 overflow-hidden rounded-md border border-[#2a2d33] bg-[#121419]/90"
                >
                  <div className="flex h-full w-full flex-col items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[#f7e7c0]">
                    <span className="text-xs font-semibold">{key}</span>
                    <span className="text-[9px] text-[#9aa0a8]">{ability.name}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs font-semibold text-white">
                      {remaining}s
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShopOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-md border border-[#454d59] bg-[#121419]/85 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#f7e7c0] shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop
            </button>
            <div className="rounded-md border border-[#454d59] bg-[#121419]/85 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#c8ccd4] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
              Gold: <span className="text-[#ffe39a]">{gold}</span>
            </div>
            {onExit && (
              <button
                onClick={onExit}
                className="rounded-md border border-[#c23c2a] bg-[#4b1411]/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white"
              >
                Exit
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 space-y-3 rounded-lg border border-[#2a2d33] bg-[#090b10]/65 p-3 backdrop-blur-sm">
        <canvas ref={minimapRef} width={180} height={180} className="rounded-md border border-[#2a2d33]" />
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`inv-${index}`}
              className="h-10 w-10 rounded-md border border-[#2a2d33] bg-[#121419]/80 text-[9px] uppercase text-[#9aa0a8]"
            >
              {inventory[index] && (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-white">
                  {SHOP_ITEMS.find((item) => item.id === inventory[index])?.name ?? ''}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`backpack-${index}`}
              className="h-10 w-10 rounded-md border border-[#2a2d33] bg-[#101216]/80 text-[9px] uppercase text-[#6f7680]"
            >
              {backpack[index] && (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-white">
                  {SHOP_ITEMS.find((item) => item.id === backpack[index])?.name ?? ''}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {shopOpen && (
        <div className="absolute bottom-32 right-6 w-80 rounded-xl border border-[#2a2d33] bg-[#0c0e12]/95 p-4 text-white shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div className="mb-3 font-[Cinzel] text-sm uppercase tracking-[0.4em] text-[#f7e7c0]">Shop</div>
          <div className="grid grid-cols-2 gap-3 text-xs uppercase tracking-[0.2em]">
            {SHOP_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handlePurchase(item.id)}
                className="rounded-md border border-[#2a2d33] bg-[#121419]/80 px-3 py-2 text-left transition hover:brightness-125"
              >
                <div className="text-white">{item.name}</div>
                <div className="text-[#9aa0a8]">{item.cost} gold</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {victory && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center text-white">
          <div className="rounded-xl border border-[#c23c2a] bg-[#1a0f0f]/90 px-8 py-6">
            <div className="font-[Cinzel] text-3xl uppercase tracking-[0.4em] text-[#f7e7c0]">
              {victory === 'radiant' ? 'Radiant' : 'Dire'} Victory
            </div>
            <p className="mt-3 text-sm text-[#c8ccd4]">The Ancient has fallen.</p>
          </div>
        </div>
      )}
    </div>
  );
};

const createMapTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#1b3a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 4);
  const riverGradient = ctx.createLinearGradient(-canvas.width / 2, 0, canvas.width / 2, 0);
  riverGradient.addColorStop(0, '#0b1a2b');
  riverGradient.addColorStop(1, '#122435');
  ctx.fillStyle = riverGradient;
  ctx.fillRect(-canvas.width / 2, -60, canvas.width, 120);
  ctx.restore();

  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = `rgba(10, 20, 10, ${Math.random() * 0.3})`;
    ctx.beginPath();
    ctx.arc(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      20 + Math.random() * 60,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  return texture;
};

const spawnTrees = (scene: THREE.Scene) => {
  const treeGeometry = new THREE.ConeGeometry(20, 80, 6);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: '#143121' });

  for (let i = 0; i < 500; i += 1) {
    const x = (Math.random() - 0.5) * MAP_SIZE;
    const z = (Math.random() - 0.5) * MAP_SIZE;
    if (Math.abs(x - z) < 260) {
      i -= 1;
      continue;
    }
    const tree = new THREE.Mesh(treeGeometry, treeMaterial);
    tree.position.set(x, 40, z);
    tree.castShadow = true;
    scene.add(tree);
  }
};

const createHeroModel = (color: string) => {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(18, 22, 60, 12),
    new THREE.MeshStandardMaterial({ color })
  );
  body.castShadow = true;
  body.position.y = 40;

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(26, 26, 26),
    new THREE.MeshStandardMaterial({ color: '#1f1f1f' })
  );
  head.position.y = 80;

  const leftArm = new THREE.Mesh(
    new THREE.BoxGeometry(8, 34, 8),
    new THREE.MeshStandardMaterial({ color })
  );
  leftArm.position.set(-20, 45, 0);
  const rightArm = leftArm.clone();
  rightArm.position.set(20, 45, 0);

  const leftLeg = new THREE.Mesh(
    new THREE.BoxGeometry(10, 30, 10),
    new THREE.MeshStandardMaterial({ color: '#181818' })
  );
  leftLeg.position.set(-8, 10, 0);
  const rightLeg = leftLeg.clone();
  rightLeg.position.set(8, 10, 0);

  group.add(body, head, leftArm, rightArm, leftLeg, rightLeg);
  group.userData.limbs = { leftArm, rightArm, leftLeg, rightLeg };
  group.userData.walkPhase = Math.random() * Math.PI * 2;
  return group;
};

const createHeroUnit = (hero: HeroData, team: Team, position: THREE.Vector3): GameUnit => {
  const color = team === 'radiant' ? '#4d9f65' : '#9f4d4d';
  const group = createHeroModel(color);

  if (hero.id === 'pudge') {
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(20, 24, 40, 10),
      new THREE.MeshStandardMaterial({ color: '#3a2a1f' })
    );
    apron.position.y = 30;
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(8, 3, 8, 16),
      new THREE.MeshStandardMaterial({ color: '#9c7c41' })
    );
    hook.position.set(24, 40, 0);
    group.add(apron, hook);
  }

  if (hero.id === 'juggernaut') {
    const sword = new THREE.Mesh(
      new THREE.BoxGeometry(6, 50, 10),
      new THREE.MeshStandardMaterial({ color: '#cc7b1e' })
    );
    sword.position.set(30, 40, 0);
    group.add(sword);
  }

  if (hero.id === 'crystal_maiden') {
    const staff = new THREE.Mesh(
      new THREE.CylinderGeometry(3, 3, 70, 8),
      new THREE.MeshStandardMaterial({ color: '#7fb9ff' })
    );
    staff.position.set(28, 50, 0);
    const cape = new THREE.Mesh(
      new THREE.ConeGeometry(30, 60, 8),
      new THREE.MeshStandardMaterial({ color: '#2e69a6', transparent: true, opacity: 0.9 })
    );
    cape.position.set(0, 40, -8);
    group.add(staff, cape);
  }

  if (hero.id === 'axe') {
    const axe = new THREE.Mesh(
      new THREE.BoxGeometry(8, 60, 28),
      new THREE.MeshStandardMaterial({ color: '#8b1f1f' })
    );
    axe.position.set(30, 45, 0);
    group.add(axe);
  }

  group.position.copy(position);

  return {
    id: `${hero.id}-${team}`,
    type: 'hero',
    team,
    mesh: group,
    radius: 30,
    hp: hero.stats.baseStr * 20,
    maxHp: hero.stats.baseStr * 20,
    damage: hero.stats.damage,
    armor: hero.stats.armor,
    range: hero.attackType === 'Ranged' ? 500 : 180,
    speed: hero.stats.speed * 1.5,
    attackCooldown: 1.2,
    attackTimer: 0,
  };
};

const createTower = (team: Team, position: THREE.Vector3): GameUnit => {
  const tower = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(40, 50, 200, 10),
    new THREE.MeshStandardMaterial({ color: team === 'radiant' ? '#326a4f' : '#6a3232' })
  );
  base.castShadow = true;
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(30),
    new THREE.MeshStandardMaterial({ color: team === 'radiant' ? '#7cd2b0' : '#d27c7c' })
  );
  crystal.position.y = 140;
  tower.add(base, crystal);
  tower.position.copy(position);
  return {
    id: `tower-${team}-${position.x}`,
    type: 'tower',
    team,
    mesh: tower,
    radius: 80,
    hp: 2000,
    maxHp: 2000,
    damage: 120,
    armor: 8,
    range: 700,
    speed: 0,
    attackCooldown: 1.5,
    attackTimer: 0,
    isBuilding: true,
  };
};

const createAncient = (team: Team, position: THREE.Vector3): GameUnit => {
  const ancient = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(200, 120, 200),
    new THREE.MeshStandardMaterial({ color: team === 'radiant' ? '#336b52' : '#6b3333' })
  );
  const top = new THREE.Mesh(
    team === 'radiant' ? new THREE.OctahedronGeometry(90) : new THREE.ConeGeometry(90, 140, 8),
    new THREE.MeshStandardMaterial({ color: team === 'radiant' ? '#7dd7b4' : '#d77d7d' })
  );
  top.position.y = 100;
  ancient.add(base, top);
  ancient.position.copy(position);

  return {
    id: `ancient-${team}`,
    type: 'ancient',
    team,
    mesh: ancient,
    radius: 120,
    hp: 4000,
    maxHp: 4000,
    damage: 200,
    armor: 12,
    range: 600,
    speed: 0,
    attackCooldown: 1.6,
    attackTimer: 0,
    isBuilding: true,
  };
};

const createFountain = (team: Team, position: THREE.Vector3): GameUnit => {
  const fountain = new THREE.Mesh(
    new THREE.CylinderGeometry(140, 140, 40, 16),
    new THREE.MeshStandardMaterial({ color: '#2b3a4a' })
  );
  fountain.position.copy(position);
  return {
    id: `fountain-${team}`,
    type: 'fountain',
    team,
    mesh: fountain,
    radius: 140,
    hp: 9999,
    maxHp: 9999,
    damage: 0,
    armor: 20,
    range: 0,
    speed: 0,
    attackCooldown: 0,
    attackTimer: 0,
    isBuilding: true,
  };
};

const getGroundPointFromMouse = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >
) => {
  if (!state) return null;
  const { camera, renderer, ground, mouse } = state;
  const raycaster = new THREE.Raycaster();
  const bounds = renderer.domElement.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    (mouse.x / bounds.width) * 2 - 1,
    -(mouse.y / bounds.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(ground);
  return hits[0]?.point ?? null;
};

const castPrimaryAbility = (
  player: GameUnit,
  hero: HeroData,
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >
) => {
  if (!state) return;
  const targetPoint = getGroundPointFromMouse(state);
  const direction = targetPoint
    ? targetPoint.clone().sub(player.mesh.position).setY(0).normalize()
    : new THREE.Vector3(1, 0, 0);

  if (hero.id === 'pudge') {
    const hookGeometry = new THREE.SphereGeometry(12, 12, 12);
    const hookMaterial = new THREE.MeshStandardMaterial({ color: '#c7a352' });
    const hookMesh = new THREE.Mesh(hookGeometry, hookMaterial);
    hookMesh.position.copy(player.mesh.position);
    state.scene.add(hookMesh);

    const chainMaterial = new THREE.LineBasicMaterial({ color: '#c7a352' });
    const chainGeometry = new THREE.BufferGeometry().setFromPoints([
      player.mesh.position.clone(),
      hookMesh.position.clone(),
    ]);
    const chain = new THREE.Line(chainGeometry, chainMaterial);
    state.scene.add(chain);

    const hook: Projectile = {
      id: `hook-${Date.now()}`,
      team: player.team,
      mesh: hookMesh,
      targetId: '',
      speed: 1400,
      damage: 150,
      type: 'hook',
      origin: player.mesh.position.clone(),
      direction,
      maxDistance: 1200,
      traveled: 0,
      casterId: player.id,
      chain,
    };
    state.projectiles.push(hook);
    return;
  }

  if (hero.id === 'axe') {
    const now = performance.now();
    state.units.forEach((unit) => {
      if (unit.team !== player.team && !unit.isBuilding) {
        const distance = unit.mesh.position.distanceTo(player.mesh.position);
        if (distance < 250) {
          unit.status = { ...(unit.status ?? {}), tauntedBy: player.id };
          unit.attackTimer = 0;
        }
      }
    });
    player.status = { ...(player.status ?? {}), bonusArmorUntil: now + 4000 };
    return;
  }

  if (hero.id === 'juggernaut') {
    player.status = { ...(player.status ?? {}), spinUntil: performance.now() + 5000 };
    return;
  }

  if (hero.id === 'crystal_maiden') {
    const target = targetPoint ?? player.mesh.position.clone().add(new THREE.Vector3(200, 0, 0));
    const nova = new THREE.Mesh(
      new THREE.CircleGeometry(120, 32),
      new THREE.MeshBasicMaterial({ color: '#7fb9ff', transparent: true, opacity: 0.4 })
    );
    nova.rotation.x = -Math.PI / 2;
    nova.position.copy(target).add(new THREE.Vector3(0, 1, 0));
    state.scene.add(nova);

    state.units.forEach((unit) => {
      if (unit.team !== player.team && !unit.isBuilding) {
        const distance = unit.mesh.position.distanceTo(nova.position);
        if (distance < 140) {
          applyDamage(unit, 100);
          unit.status = { ...(unit.status ?? {}), slowUntil: performance.now() + 4000 };
        }
      }
    });
    setTimeout(() => {
      state.scene.remove(nova);
    }, 600);
  }
};

const updateCamera = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  delta: number
) => {
  if (!state) return;
  const { camera, mouse } = state;
  if (!mouse.inBounds) return;

  const panSpeed = 1200 * delta;
  const { innerWidth, innerHeight } = window;

  if (mouse.x < EDGE_PAN_DISTANCE) {
    camera.position.x -= panSpeed;
    camera.position.z += panSpeed;
  }
  if (mouse.x > innerWidth - EDGE_PAN_DISTANCE) {
    camera.position.x += panSpeed;
    camera.position.z -= panSpeed;
  }
  if (mouse.y < EDGE_PAN_DISTANCE) {
    camera.position.x -= panSpeed;
    camera.position.z -= panSpeed;
  }
  if (mouse.y > innerHeight - EDGE_PAN_DISTANCE) {
    camera.position.x += panSpeed;
    camera.position.z += panSpeed;
  }

  camera.lookAt(0, 0, 0);
};

const findClosestEnemy = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  unit: GameUnit,
  range: number
) => {
  let closest: GameUnit | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  state.units.forEach((candidate) => {
    if (candidate.team === unit.team) return;
    if (candidate.hp <= 0) return;
    const distance = candidate.mesh.position.distanceTo(unit.mesh.position);
    if (distance <= range && distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  });
  return closest;
};

const applyDamage = (unit: GameUnit, amount: number) => {
  const armorMultiplier = 100 / (100 + unit.armor * 6);
  unit.hp -= amount * armorMultiplier;
};

const updateUnits = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  delta: number,
  setVictory: React.Dispatch<React.SetStateAction<Team | null>>
) => {
  if (!state) return;
  const now = performance.now();

  state.units.forEach((unit) => {
    if (unit.type === 'ancient' && unit.hp <= 0) {
      setVictory(unit.team === 'radiant' ? 'dire' : 'radiant');
      return;
    }

    if (unit.hp <= 0) return;

    if (unit.type === 'tower') {
      const target = findClosestEnemy(state, unit, unit.range);
      if (target) {
        unit.targetId = target.id;
      }
    }

    if (unit.type === 'creep' && !unit.targetId) {
      const target = findClosestEnemy(state, unit, unit.range + 100);
      if (target) {
        unit.targetId = target.id;
      }
    }

    if (unit.status?.tauntedBy) {
      unit.targetId = unit.status.tauntedBy;
    }

    const target = unit.targetId ? state.units.find((candidate) => candidate.id === unit.targetId) : null;
    const isMovingToTarget = target && target.hp > 0 && unit.mesh.position.distanceTo(target.mesh.position) > unit.range;

    const slowMultiplier = unit.status?.slowUntil && unit.status.slowUntil > now ? 0.6 : 1;
    const currentSpeed = unit.speed * slowMultiplier;

    if (unit.type === 'hero' && unit.moveTarget) {
      const direction = unit.moveTarget.clone().sub(unit.mesh.position);
      if (direction.length() < 10) {
        unit.moveTarget = undefined;
      } else {
        direction.normalize();
        unit.mesh.position.add(direction.multiplyScalar(currentSpeed * delta));
      }
    }

    if (target && target.hp > 0) {
      const distance = unit.mesh.position.distanceTo(target.mesh.position);
      if (distance <= unit.range) {
        unit.attackTimer -= delta;
        if (unit.attackTimer <= 0) {
          unit.attackTimer = unit.attackCooldown;
          spawnProjectile(state, unit, target);
        }
      } else if (!unit.isBuilding) {
        const direction = target.mesh.position.clone().sub(unit.mesh.position).normalize();
        unit.mesh.position.add(direction.multiplyScalar(currentSpeed * delta));
      }
    }

    if (unit.type === 'creep' && !target) {
      unit.mesh.position.add(
        unit.moveTarget
          ? unit.moveTarget.clone().sub(unit.mesh.position).normalize().multiplyScalar(currentSpeed * delta)
          : new THREE.Vector3(0, 0, 0)
      );
    }

    if (unit.status?.spinUntil && unit.status.spinUntil > now) {
      state.units.forEach((enemy) => {
        if (enemy.team === unit.team || enemy.hp <= 0 || enemy.isBuilding) return;
        const distance = enemy.mesh.position.distanceTo(unit.mesh.position);
        if (distance < 200) {
          applyDamage(enemy, 40 * delta);
        }
      });
    }

    const limbs = unit.mesh.userData.limbs as
      | { leftArm: THREE.Object3D; rightArm: THREE.Object3D; leftLeg: THREE.Object3D; rightLeg: THREE.Object3D }
      | undefined;
    if (limbs) {
      unit.mesh.userData.walkPhase += delta * (isMovingToTarget || unit.moveTarget ? 6 : 1);
      const wave = Math.sin(unit.mesh.userData.walkPhase) * 0.6;
      limbs.leftArm.rotation.x = wave;
      limbs.rightArm.rotation.x = -wave;
      limbs.leftLeg.rotation.x = -wave;
      limbs.rightLeg.rotation.x = wave;
    }
  });

  for (let i = 0; i < state.units.length; i += 1) {
    for (let j = i + 1; j < state.units.length; j += 1) {
      const a = state.units[i];
      const b = state.units[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const distance = a.mesh.position.distanceTo(b.mesh.position);
      const minDistance = a.radius + b.radius;
      if (distance < minDistance) {
        const overlap = minDistance - distance;
        const direction = a.mesh.position.clone().sub(b.mesh.position).normalize();
        a.mesh.position.add(direction.multiplyScalar(overlap * 0.5));
        b.mesh.position.add(direction.multiplyScalar(-overlap * 0.5));
      }
    }
  }

  if (Math.floor(now / 30000) !== Math.floor((now - delta * 1000) / 30000)) {
    spawnCreeps(state, 'radiant');
    spawnCreeps(state, 'dire');
  }
};

const spawnProjectile = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  attacker: GameUnit,
  target: GameUnit
) => {
  const geometry = new THREE.SphereGeometry(8, 8, 8);
  const material = new THREE.MeshStandardMaterial({ color: attacker.team === 'radiant' ? '#7cd2b0' : '#d27c7c' });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(attacker.mesh.position);
  state.scene.add(mesh);

  state.projectiles.push({
    id: `proj-${Date.now()}-${Math.random()}`,
    team: attacker.team,
    mesh,
    targetId: target.id,
    speed: 800,
    damage: attacker.damage,
    type: 'basic',
    origin: attacker.mesh.position.clone(),
    direction: target.mesh.position.clone().sub(attacker.mesh.position).normalize(),
    maxDistance: 800,
    traveled: 0,
    casterId: attacker.id,
  });
};

const updateProjectiles = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  delta: number
) => {
  for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = state.projectiles[i];
    const moveDistance = projectile.speed * delta;
    projectile.mesh.position.add(projectile.direction.clone().multiplyScalar(moveDistance));
    projectile.traveled += moveDistance;

    if (projectile.chain && projectile.type === 'hook') {
      const chainGeometry = new THREE.BufferGeometry().setFromPoints([
        projectile.origin.clone(),
        projectile.mesh.position.clone(),
      ]);
      projectile.chain.geometry.dispose();
      projectile.chain.geometry = chainGeometry;
    }

    const target = state.units.find((unit) => unit.id === projectile.targetId);
    const hitCandidate = state.units.find((unit) => {
      if (unit.id === projectile.casterId) return false;
      if (projectile.type === 'hook') {
        if (unit.isBuilding) return false;
        if (unit.team === projectile.team) return false;
      }
      const distance = unit.mesh.position.distanceTo(projectile.mesh.position);
      return distance < unit.radius + 6;
    });

    if (hitCandidate) {
      if (projectile.type === 'hook') {
        hitCandidate.mesh.position.copy(projectile.origin.clone());
        hitCandidate.moveTarget = undefined;
      } else {
        applyDamage(hitCandidate, projectile.damage);
      }
      state.scene.remove(projectile.mesh);
      projectile.chain && state.scene.remove(projectile.chain);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (target && projectile.mesh.position.distanceTo(target.mesh.position) < target.radius) {
      applyDamage(target, projectile.damage);
      state.scene.remove(projectile.mesh);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (projectile.traveled >= projectile.maxDistance) {
      state.scene.remove(projectile.mesh);
      projectile.chain && state.scene.remove(projectile.chain);
      state.projectiles.splice(i, 1);
    }
  }
};

const spawnCreeps = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  team: Team
) => {
  const spawnPosition = team === 'radiant' ? new THREE.Vector3(-1200, 0, -1200) : new THREE.Vector3(1200, 0, 1200);
  for (let i = 0; i < 3; i += 1) {
    const creep = createHeroModel(team === 'radiant' ? '#3f7f5a' : '#7f3f3f');
    creep.position.copy(spawnPosition.clone().add(new THREE.Vector3(i * 40, 0, i * 40)));
    state.scene.add(creep);

    state.units.push({
      id: `creep-${team}-${Date.now()}-${i}`,
      type: 'creep',
      team,
      mesh: creep,
      radius: 20,
      hp: 300,
      maxHp: 300,
      damage: 25,
      armor: 1,
      range: 150,
      speed: 220,
      attackCooldown: 1.5,
      attackTimer: 0,
      moveTarget: team === 'radiant' ? new THREE.Vector3(2200, 0, 2200) : new THREE.Vector3(-2200, 0, -2200),
    });
  }
};

const updateMinimap = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
          ground: THREE.Mesh;
          units: GameUnit[];
          projectiles: Projectile[];
          playerId: string;
          mouse: { x: number; y: number; inBounds: boolean };
          lastTime: number;
          gold: number;
          inventory: string[];
          backpack: string[];
          abilityCooldowns: Record<string, number>;
        }
      | null
    >['current']
  >,
  canvas: HTMLCanvasElement | null
) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f1012';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  state.units.forEach((unit) => {
    const x = ((unit.mesh.position.x + MAP_SIZE / 2) / MAP_SIZE) * canvas.width;
    const y = ((unit.mesh.position.z + MAP_SIZE / 2) / MAP_SIZE) * canvas.height;
    ctx.fillStyle = unit.team === 'radiant' ? '#7cd2b0' : '#d27c7c';
    ctx.beginPath();
    ctx.arc(x, y, unit.type === 'hero' ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  });

  const camDir = new THREE.Vector3();
  state.camera.getWorldDirection(camDir);
  camDir.y = 0;
  camDir.normalize();
  const sideDir = new THREE.Vector3(-camDir.z, 0, camDir.x);

  const camPos = state.camera.position.clone();
  const nearCenter = camPos.clone().add(camDir.clone().multiplyScalar(200));
  const farCenter = camPos.clone().add(camDir.clone().multiplyScalar(600));
  const nearWidth = 200;
  const farWidth = 500;

  const nearLeft = nearCenter.clone().add(sideDir.clone().multiplyScalar(-nearWidth / 2));
  const nearRight = nearCenter.clone().add(sideDir.clone().multiplyScalar(nearWidth / 2));
  const farLeft = farCenter.clone().add(sideDir.clone().multiplyScalar(-farWidth / 2));
  const farRight = farCenter.clone().add(sideDir.clone().multiplyScalar(farWidth / 2));

  const toMini = (pos: THREE.Vector3) => ({
    x: ((pos.x + MAP_SIZE / 2) / MAP_SIZE) * canvas.width,
    y: ((pos.z + MAP_SIZE / 2) / MAP_SIZE) * canvas.height,
  });

  const nL = toMini(nearLeft);
  const nR = toMini(nearRight);
  const fR = toMini(farRight);
  const fL = toMini(farLeft);

  ctx.strokeStyle = '#f7e7c0';
  ctx.beginPath();
  ctx.moveTo(nL.x, nL.y);
  ctx.lineTo(nR.x, nR.y);
  ctx.lineTo(fR.x, fR.y);
  ctx.lineTo(fL.x, fL.y);
  ctx.closePath();
  ctx.stroke();
};

export default GameScreen;
