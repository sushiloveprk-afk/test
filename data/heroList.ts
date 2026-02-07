export type HeroAttribute = 'str' | 'agi' | 'int';
export type HeroAttackType = 'Melee' | 'Ranged';

export interface HeroAbility {
  name: string;
  cooldown: number;
}

export interface HeroStats {
  damage: number;
  armor: number;
  speed: number;
  baseStr: number;
  baseAgi: number;
  baseInt: number;
}

export interface HeroData {
  id: string;
  name: string;
  attribute: HeroAttribute;
  attackType: HeroAttackType;
  stats: HeroStats;
  abilities: HeroAbility[];
  image: string;
  render: string;
}

export const HERO_IMAGE_BASE_URL =
  'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes';
export const HERO_RENDER_BASE_URL =
  'https://cdn.cloudflare.steamstatic.com/apps/dota2/videos/dota_react/heroes/renders';

export const heroList: HeroData[] = [
  {
    id: 'antimage',
    name: 'Anti-Mage',
    attribute: 'agi',
    attackType: 'Melee',
    stats: { damage: 56, armor: 4, speed: 310, baseStr: 21, baseAgi: 24, baseInt: 12 },
    abilities: [
      { name: 'Mana Break', cooldown: 0 },
      { name: 'Blink', cooldown: 12 },
      { name: 'Counterspell', cooldown: 15 },
      { name: 'Mana Void', cooldown: 70 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/antimage.png`,
    render: `${HERO_RENDER_BASE_URL}/antimage.png`,
  },
  {
    id: 'nevermore',
    name: 'Shadow Fiend',
    attribute: 'agi',
    attackType: 'Ranged',
    stats: { damage: 57, armor: 4, speed: 305, baseStr: 19, baseAgi: 25, baseInt: 18 },
    abilities: [
      { name: 'Shadowraze', cooldown: 10 },
      { name: 'Necromastery', cooldown: 0 },
      { name: 'Presence of the Dark Lord', cooldown: 0 },
      { name: 'Requiem of Souls', cooldown: 120 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/nevermore.png`,
    render: `${HERO_RENDER_BASE_URL}/nevermore.png`,
  },
  {
    id: 'windrunner',
    name: 'Windranger',
    attribute: 'agi',
    attackType: 'Ranged',
    stats: { damage: 52, armor: 3, speed: 295, baseStr: 18, baseAgi: 17, baseInt: 20 },
    abilities: [
      { name: 'Shackleshot', cooldown: 12 },
      { name: 'Powershot', cooldown: 9 },
      { name: 'Windrun', cooldown: 15 },
      { name: 'Focus Fire', cooldown: 70 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/windranger.png`,
    render: `${HERO_RENDER_BASE_URL}/windranger.png`,
  },
  {
    id: 'zuus',
    name: 'Zeus',
    attribute: 'int',
    attackType: 'Ranged',
    stats: { damage: 53, armor: 2, speed: 315, baseStr: 19, baseAgi: 11, baseInt: 22 },
    abilities: [
      { name: 'Arc Lightning', cooldown: 1.6 },
      { name: 'Lightning Bolt', cooldown: 6 },
      { name: 'Heavenly Jump', cooldown: 20 },
      { name: 'Thundergod\'s Wrath', cooldown: 120 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/zuus.png`,
    render: `${HERO_RENDER_BASE_URL}/zuus.png`,
  },
  {
    id: 'queenofpain',
    name: 'Queen of Pain',
    attribute: 'int',
    attackType: 'Ranged',
    stats: { damage: 56, armor: 2, speed: 310, baseStr: 18, baseAgi: 22, baseInt: 22 },
    abilities: [
      { name: 'Shadow Strike', cooldown: 10 },
      { name: 'Blink', cooldown: 12 },
      { name: 'Scream of Pain', cooldown: 7 },
      { name: 'Sonic Wave', cooldown: 110 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/queenofpain.png`,
    render: `${HERO_RENDER_BASE_URL}/queenofpain.png`,
  },
  {
    id: 'wraith_king',
    name: 'Wraith King',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 60, armor: 5, speed: 315, baseStr: 22, baseAgi: 16, baseInt: 18 },
    abilities: [
      { name: 'Wraithfire Blast', cooldown: 7 },
      { name: 'Vampiric Spirit', cooldown: 30 },
      { name: 'Mortal Strike', cooldown: 0 },
      { name: 'Reincarnation', cooldown: 200 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/skeleton_king.png`,
    render: `${HERO_RENDER_BASE_URL}/skeleton_king.png`,
  },
  {
    id: 'nature_prophet',
    name: "Nature's Prophet",
    attribute: 'int',
    attackType: 'Ranged',
    stats: { damage: 55, armor: 3, speed: 295, baseStr: 21, baseAgi: 18, baseInt: 24 },
    abilities: [
      { name: 'Sprout', cooldown: 11 },
      { name: 'Teleportation', cooldown: 45 },
      { name: 'Nature\'s Call', cooldown: 35 },
      { name: 'Wrath of Nature', cooldown: 90 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/nature_prophet.png`,
    render: `${HERO_RENDER_BASE_URL}/nature_prophet.png`,
  },
  {
    id: 'rattletrap',
    name: 'Clockwerk',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 52, armor: 4, speed: 310, baseStr: 26, baseAgi: 13, baseInt: 18 },
    abilities: [
      { name: 'Battery Assault', cooldown: 32 },
      { name: 'Power Cogs', cooldown: 15 },
      { name: 'Rocket Flare', cooldown: 20 },
      { name: 'Hookshot', cooldown: 60 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/clockwerk.png`,
    render: `${HERO_RENDER_BASE_URL}/clockwerk.png`,
  },
  {
    id: 'doom_bringer',
    name: 'Doom',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 63, armor: 2, speed: 290, baseStr: 24, baseAgi: 11, baseInt: 15 },
    abilities: [
      { name: 'Devour', cooldown: 70 },
      { name: 'Scorched Earth', cooldown: 55 },
      { name: 'Infernal Blade', cooldown: 12 },
      { name: 'Doom', cooldown: 145 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/doom.png`,
    render: `${HERO_RENDER_BASE_URL}/doom.png`,
  },
  {
    id: 'shredder',
    name: 'Timbersaw',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 59, armor: 5, speed: 290, baseStr: 26, baseAgi: 16, baseInt: 23 },
    abilities: [
      { name: 'Whirling Death', cooldown: 8 },
      { name: 'Timber Chain', cooldown: 10 },
      { name: 'Reactive Armor', cooldown: 0 },
      { name: 'Chakram', cooldown: 8 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/timbersaw.png`,
    render: `${HERO_RENDER_BASE_URL}/timbersaw.png`,
  },
  {
    id: 'magnataur',
    name: 'Magnus',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 58, armor: 4, speed: 305, baseStr: 25, baseAgi: 15, baseInt: 19 },
    abilities: [
      { name: 'Shockwave', cooldown: 9 },
      { name: 'Empower', cooldown: 10 },
      { name: 'Skewer', cooldown: 25 },
      { name: 'Reverse Polarity', cooldown: 120 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/magnus.png`,
    render: `${HERO_RENDER_BASE_URL}/magnus.png`,
  },
  {
    id: 'centaur',
    name: 'Centaur Warrunner',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 62, armor: 3, speed: 300, baseStr: 27, baseAgi: 15, baseInt: 15 },
    abilities: [
      { name: 'Hoof Stomp', cooldown: 12 },
      { name: 'Double Edge', cooldown: 5 },
      { name: 'Retaliate', cooldown: 0 },
      { name: 'Stampede', cooldown: 100 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/centaur_warrunner.png`,
    render: `${HERO_RENDER_BASE_URL}/centaur_warrunner.png`,
  },
  {
    id: 'treant',
    name: 'Treant Protector',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 60, armor: 4, speed: 285, baseStr: 25, baseAgi: 15, baseInt: 20 },
    abilities: [
      { name: 'Nature\'s Grasp', cooldown: 20 },
      { name: 'Leech Seed', cooldown: 18 },
      { name: 'Living Armor', cooldown: 20 },
      { name: 'Overgrowth', cooldown: 100 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/treant_protector.png`,
    render: `${HERO_RENDER_BASE_URL}/treant_protector.png`,
  },
  {
    id: 'axe',
    name: 'Axe',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 62, armor: 6, speed: 310, baseStr: 25, baseAgi: 20, baseInt: 18 },
    abilities: [
      { name: 'Berserker\'s Call', cooldown: 16 },
      { name: 'Battle Hunger', cooldown: 5 },
      { name: 'Counter Helix', cooldown: 0 },
      { name: 'Culling Blade', cooldown: 75 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/axe.png`,
    render: `${HERO_RENDER_BASE_URL}/axe.png`,
  },
  {
    id: 'pudge',
    name: 'Pudge',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 61, armor: 3, speed: 280, baseStr: 25, baseAgi: 14, baseInt: 16 },
    abilities: [
      { name: 'Meat Hook', cooldown: 13 },
      { name: 'Rot', cooldown: 0 },
      { name: 'Flesh Heap', cooldown: 0 },
      { name: 'Dismember', cooldown: 25 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/pudge.png`,
    render: `${HERO_RENDER_BASE_URL}/pudge.png`,
  },
  {
    id: 'juggernaut',
    name: 'Juggernaut',
    attribute: 'agi',
    attackType: 'Melee',
    stats: { damage: 59, armor: 3, speed: 305, baseStr: 20, baseAgi: 26, baseInt: 14 },
    abilities: [
      { name: 'Blade Fury', cooldown: 30 },
      { name: 'Healing Ward', cooldown: 60 },
      { name: 'Blade Dance', cooldown: 0 },
      { name: 'Omnislash', cooldown: 120 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/juggernaut.png`,
    render: `${HERO_RENDER_BASE_URL}/juggernaut.png`,
  },
  {
    id: 'crystal_maiden',
    name: 'Crystal Maiden',
    attribute: 'int',
    attackType: 'Ranged',
    stats: { damage: 45, armor: 1, speed: 280, baseStr: 16, baseAgi: 16, baseInt: 18 },
    abilities: [
      { name: 'Crystal Nova', cooldown: 11 },
      { name: 'Frostbite', cooldown: 9 },
      { name: 'Arcane Aura', cooldown: 0 },
      { name: 'Freezing Field', cooldown: 110 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/crystal_maiden.png`,
    render: `${HERO_RENDER_BASE_URL}/crystal_maiden.png`,
  },
  {
    id: 'sniper',
    name: 'Sniper',
    attribute: 'agi',
    attackType: 'Ranged',
    stats: { damage: 46, armor: 3, speed: 285, baseStr: 19, baseAgi: 21, baseInt: 15 },
    abilities: [
      { name: 'Shrapnel', cooldown: 24 },
      { name: 'Headshot', cooldown: 0 },
      { name: 'Take Aim', cooldown: 20 },
      { name: 'Assassinate', cooldown: 20 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/sniper.png`,
    render: `${HERO_RENDER_BASE_URL}/sniper.png`,
  },
  {
    id: 'earthshaker',
    name: 'Earthshaker',
    attribute: 'str',
    attackType: 'Melee',
    stats: { damage: 60, armor: 3, speed: 310, baseStr: 22, baseAgi: 12, baseInt: 18 },
    abilities: [
      { name: 'Fissure', cooldown: 15 },
      { name: 'Enchant Totem', cooldown: 5 },
      { name: 'Aftershock', cooldown: 0 },
      { name: 'Echo Slam', cooldown: 150 },
    ],
    image: `${HERO_IMAGE_BASE_URL}/earthshaker.png`,
    render: `${HERO_RENDER_BASE_URL}/earthshaker.png`,
  },
];
