import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { heroList, HeroData } from '../../data/heroList';
import { ShoppingBag } from 'lucide-react';

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

const GameScreen: React.FC<GameScreenProps> = ({ selectedHero, onExit }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const gameStateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
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

    const enemyHero = createHeroUnit(heroList.find((hero) => hero.id === 'pudge') ?? heroData, 'dire', new THREE.Vector3(600, 0, 600));
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
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
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
      requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
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

  return (
    <div ref={containerRef} className="relative h-screen w-screen overflow-hidden bg-[#0f1012]">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[#0f1012]/20 to-[#0f1012]" />

      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-6 pb-4 text-white">
        <div className="flex items-end gap-4">
          <div className="h-24 w-24 overflow-hidden rounded-md border border-[#2a2d33]">
            <img src={currentHeroImage} alt={heroData.name} className="h-full w-full object-cover" />
          </div>
          <div className="space-y-2">
            <div className="font-[Cinzel] text-lg uppercase tracking-[0.3em] text-[#f7e7c0]">
              {heroData.name}
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs uppercase tracking-[0.2em] text-[#9aa0a8]">
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
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShopOpen((prev) => !prev)}
            className="flex items-center gap-2 rounded-md border border-[#2a2d33] bg-[#121419]/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#f7e7c0]"
          >
            <ShoppingBag className="h-4 w-4" />
            Shop
          </button>
          <div className="rounded-md border border-[#2a2d33] bg-[#121419]/80 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#c8ccd4]">
            Gold: <span className="text-white">{gold}</span>
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

      <div className="absolute bottom-4 left-4">
        <canvas ref={minimapRef} width={180} height={180} className="rounded-md border border-[#2a2d33]" />
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

  const riverGradient = ctx.createLinearGradient(0, canvas.height * 0.4, canvas.width, canvas.height * 0.6);
  riverGradient.addColorStop(0, '#0b1a2b');
  riverGradient.addColorStop(1, '#122435');
  ctx.fillStyle = riverGradient;
  ctx.fillRect(0, canvas.height * 0.45, canvas.width, canvas.height * 0.1);

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
    if (Math.abs(z) < 200) {
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
    hp: 1000,
    maxHp: 1000,
    damage: hero.stats.damage,
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
    range: 0,
    speed: 0,
    attackCooldown: 0,
    attackTimer: 0,
    isBuilding: true,
  };
};

const castPrimaryAbility = (player: GameUnit, hero: HeroData, state: NonNullable<
  React.MutableRefObject<
    | {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
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
>) => {
  if (!state) return;
  const direction = new THREE.Vector3(1, 0, 0);
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
    player.status = { ...(player.status ?? {}), spinUntil: now + 4000 };
    return;
  }

  if (hero.id === 'juggernaut') {
    player.status = { ...(player.status ?? {}), spinUntil: performance.now() + 5000 };
    return;
  }

  if (hero.id === 'crystal_maiden') {
    const nova = new THREE.Mesh(
      new THREE.CircleGeometry(120, 32),
      new THREE.MeshBasicMaterial({ color: '#7fb9ff', transparent: true, opacity: 0.4 })
    );
    nova.rotation.x = -Math.PI / 2;
    nova.position.copy(player.mesh.position).add(new THREE.Vector3(200, 1, 0));
    state.scene.add(nova);

    state.units.forEach((unit) => {
      if (unit.team !== player.team) {
        const distance = unit.mesh.position.distanceTo(nova.position);
        if (distance < 140) {
          unit.hp -= 100;
          unit.status = { ...(unit.status ?? {}), slowUntil: performance.now() + 4000 };
        }
      }
    });
    setTimeout(() => {
      state.scene.remove(nova);
    }, 600);
  }
};

const updateCamera = (state: NonNullable<
  React.MutableRefObject<
    | {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
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

const updateUnits = (
  state: NonNullable<
    React.MutableRefObject<
      | {
          scene: THREE.Scene;
          camera: THREE.PerspectiveCamera;
          renderer: THREE.WebGLRenderer;
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

    if (unit.type === 'hero' && unit.moveTarget) {
      const direction = unit.moveTarget.clone().sub(unit.mesh.position);
      if (direction.length() < 10) {
        unit.moveTarget = undefined;
      } else {
        direction.normalize();
        unit.mesh.position.add(direction.multiplyScalar(unit.speed * delta));
      }
    }

    if (unit.status?.tauntedBy) {
      unit.targetId = unit.status.tauntedBy;
    }

    if (unit.targetId) {
      const target = state.units.find((candidate) => candidate.id === unit.targetId);
      if (target && target.hp > 0) {
        const distance = unit.mesh.position.distanceTo(target.mesh.position);
        if (distance <= unit.range) {
          unit.attackTimer -= delta;
          if (unit.attackTimer <= 0) {
            unit.attackTimer = unit.attackCooldown;
            spawnProjectile(state, unit, target);
          }
        } else {
          const direction = target.mesh.position.clone().sub(unit.mesh.position).normalize();
          unit.mesh.position.add(direction.multiplyScalar(unit.speed * delta));
        }
      }
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

const spawnProjectile = (state: NonNullable<
  React.MutableRefObject<
    | {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
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

const updateProjectiles = (state: NonNullable<
  React.MutableRefObject<
    | {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
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
        hitCandidate.mesh.position.copy(projectile.origin.clone().add(new THREE.Vector3(20, 0, 20)));
      } else {
        hitCandidate.hp -= projectile.damage;
      }
      state.scene.remove(projectile.mesh);
      projectile.chain && state.scene.remove(projectile.chain);
      state.projectiles.splice(i, 1);
      continue;
    }

    if (target && projectile.mesh.position.distanceTo(target.mesh.position) < target.radius) {
      target.hp -= projectile.damage;
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

const spawnCreeps = (state: NonNullable<
  React.MutableRefObject<
    | {
        scene: THREE.Scene;
        camera: THREE.PerspectiveCamera;
        renderer: THREE.WebGLRenderer;
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

  const camX = ((state.camera.position.x + MAP_SIZE / 2) / MAP_SIZE) * canvas.width;
  const camY = ((state.camera.position.z + MAP_SIZE / 2) / MAP_SIZE) * canvas.height;
  ctx.strokeStyle = '#f7e7c0';
  ctx.strokeRect(camX - 18, camY - 18, 36, 36);
};

export default GameScreen;
