import React, { useEffect, useMemo, useRef, useState } from 'react';
import { heroList, HeroData } from '../../data/heroList';
import { Search } from 'lucide-react';

interface HeroSelectionScreenProps {
  onLockIn: (hero: HeroData) => void;
}

type TeamSlot = HeroData | null;

type AttributeFilter = 'all' | 'str' | 'agi' | 'int';

const RADIANT_SLOTS = 5;
const DIRE_SLOTS = 5;

const HeroSelectionScreen: React.FC<HeroSelectionScreenProps> = ({ onLockIn }) => {
  const [selectedHero, setSelectedHero] = useState<HeroData | null>(null);
  const [lockedHero, setLockedHero] = useState<HeroData | null>(null);
  const [attributeFilter, setAttributeFilter] = useState<AttributeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [timer, setTimer] = useState(60);
  const [radiantSlots, setRadiantSlots] = useState<TeamSlot[]>(Array(RADIANT_SLOTS).fill(null));
  const [direSlots, setDireSlots] = useState<TeamSlot[]>(Array(DIRE_SLOTS).fill(null));
  const [pickedIds, setPickedIds] = useState<Set<string>>(new Set());

  const pickedIdsRef = useRef(pickedIds);
  const selectedHeroRef = useRef<HeroData | null>(selectedHero);

  useEffect(() => {
    pickedIdsRef.current = pickedIds;
  }, [pickedIds]);

  useEffect(() => {
    selectedHeroRef.current = selectedHero;
  }, [selectedHero]);

  const filteredHeroes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return heroList.filter((hero) => {
      const matchesAttribute = attributeFilter === 'all' || hero.attribute === attributeFilter;
      if (!matchesAttribute) return false;
      if (!search) return true;

      return (
        hero.name.toLowerCase().includes(search) ||
        hero.id.toLowerCase().includes(search) ||
        hero.attackType.toLowerCase().includes(search) ||
        hero.attribute.toLowerCase().includes(search) ||
        hero.abilities.some((ability) => ability.name.toLowerCase().includes(search))
      );
    });
  }, [attributeFilter, searchTerm]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : prev));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;
    const tick = () => {
      const currentSelected = selectedHeroRef.current;
      const nextPicked = new Set(pickedIdsRef.current);

      if (currentSelected) {
        nextPicked.add(currentSelected.id);
      }

      setDireSlots((prev) => {
        const updated = [...prev];
        const emptyIndex = updated.findIndex((slot) => !slot);
        if (emptyIndex !== -1) {
          const available = heroList.filter((hero) => !nextPicked.has(hero.id));
          if (available.length > 0) {
            const choice = available[Math.floor(Math.random() * available.length)];
            updated[emptyIndex] = choice;
            nextPicked.add(choice.id);
          }
        }
        return updated;
      });

      setRadiantSlots((prev) => {
        const updated = [...prev];
        const emptyIndex = updated.findIndex((slot) => !slot);
        if (emptyIndex !== -1) {
          const available = heroList.filter((hero) => !nextPicked.has(hero.id));
          if (available.length > 0) {
            const choice = available[Math.floor(Math.random() * available.length)];
            updated[emptyIndex] = choice;
            nextPicked.add(choice.id);
          }
        }
        return updated;
      });

      setPickedIds(nextPicked);

      timeoutId = window.setTimeout(tick, 150 + Math.random() * 350);
    };

    timeoutId = window.setTimeout(tick, 200);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const handleSelectHero = (hero: HeroData) => {
    if (pickedIds.has(hero.id)) return;
    setSelectedHero(hero);
  };

  const handleLockIn = (heroToLock = selectedHero) => {
    if (!heroToLock) return;
    setLockedHero(heroToLock);
    setPickedIds((ids) => new Set(ids).add(heroToLock.id));
    setRadiantSlots((prev) => {
      const updated = [...prev];
      const firstEmpty = updated.findIndex((slot) => !slot);
      if (firstEmpty !== -1) updated[firstEmpty] = heroToLock;
      return updated;
    });
    onLockIn(heroToLock);
  };

  const heroPreview = selectedHero ?? heroList[0];

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b0d12] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#232732,_#0b0d12_68%)] opacity-90" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(194,60,42,0.08),transparent_25%,transparent_75%,rgba(111,153,255,0.08))]" />
      <div className="pointer-events-none absolute -left-28 top-14 h-72 w-72 rounded-full bg-[#c23c2a]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 rounded-full bg-[#4b74d4]/20 blur-[130px]" />

      <header className="relative z-10 flex items-center justify-between px-8 pt-6 font-[Cinzel] uppercase tracking-[0.3em] text-sm text-[#f5e7cf]">
        <div className="flex flex-col gap-3">
          <div className="text-xs tracking-[0.6em] text-[#8c8f94]">RADIANT</div>
          <div className="flex items-center gap-2">
            {radiantSlots.map((slot, index) => (
              <div
                key={`radiant-top-${index}`}
                className="relative h-10 w-16 -skew-x-12 overflow-hidden rounded-md border border-[#2a2d33] bg-[#111318]/80"
              >
                {slot ? (
                  <img src={slot.image} alt={slot.name} className="h-full w-full object-cover grayscale" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-[#4a4f57]">{index + 1}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs tracking-[0.6em] text-[#8c8f94]">PICK YOUR HERO</div>
          <div className="mt-2 text-3xl font-bold text-[#c23c2a]">{timer}s</div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="text-xs tracking-[0.6em] text-[#8c8f94]">DIRE</div>
          <div className="flex items-center gap-2">
            {direSlots.map((slot, index) => (
              <div
                key={`dire-top-${index}`}
                className="relative h-10 w-16 -skew-x-12 overflow-hidden rounded-md border border-[#2a2d33] bg-[#111318]/80"
              >
                {slot ? (
                  <img src={slot.image} alt={slot.name} className="h-full w-full object-cover grayscale" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-[#4a4f57]">{index + 1}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="relative z-10 mt-6 grid h-[calc(100%-8rem)] grid-cols-[1.4fr_2.2fr_1.4fr] gap-6 px-8 pb-8">
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-[#343943] bg-[#14161b]/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm">
            <h2 className="mb-4 font-[Cinzel] text-xs uppercase tracking-[0.4em] text-[#d7c9ac]">Radiant</h2>
            <div className="space-y-3">
              {radiantSlots.map((slot, index) => (
                <div
                  key={`radiant-${index}`}
                  className="flex items-center gap-3 rounded-md border border-[#2a2d33] bg-[#101215]/85 px-3 py-2"
                >
                  <div className="h-12 w-12 -skew-x-12 overflow-hidden rounded-sm border border-[#2f3238]">
                    {slot ? (
                      <img src={slot.image} alt={slot.name} className="h-full w-full object-cover grayscale" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-[#4a4f57]">Empty</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-[#9aa0a8]">Slot {index + 1}</div>
                    <div className="text-sm font-semibold text-white">{slot?.name ?? 'Waiting...'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {(['str', 'agi', 'int'] as const).map((attr) => (
                <button
                  key={attr}
                  onClick={() => setAttributeFilter(attr)}
                  className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:brightness-125 ${
                    attributeFilter === attr ? 'border-white text-white' : 'border-[#2a2d33] text-[#9aa0a8]'
                  } ${
                    attr === 'str'
                      ? 'bg-[#531b1b]/70'
                      : attr === 'agi'
                      ? 'bg-[#1b4b26]/70'
                      : 'bg-[#1b2c4b]/70'
                  }`}
                >
                  {attr === 'str' ? 'Strength' : attr === 'agi' ? 'Agility' : 'Intelligence'}
                </button>
              ))}
              <button
                onClick={() => setAttributeFilter('all')}
                className={`rounded-md border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition hover:brightness-125 ${
                  attributeFilter === 'all' ? 'border-white text-white' : 'border-[#2a2d33] text-[#9aa0a8]'
                } bg-[#23252b]/70`}
              >
                All
              </button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6d7179]" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search hero or role"
                className="w-64 rounded-md border border-[#2a2d33] bg-[#111318] py-2 pl-10 pr-3 text-xs uppercase tracking-[0.2em] text-[#c8ccd4] placeholder:text-[#4f545c]"
              />
            </div>
          </div>

          <div className="grid flex-1 grid-cols-4 gap-3 overflow-y-auto rounded-xl border border-[#343943] bg-[#14161b]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
            {filteredHeroes.map((hero) => (
              <button
                key={hero.id}
                onClick={() => handleSelectHero(hero)}
                onDoubleClick={() => handleLockIn(hero)}
                disabled={pickedIds.has(hero.id)}
                className={`group relative flex h-28 flex-col items-start justify-end overflow-hidden rounded-md border border-transparent bg-[#0f1116] text-left transition hover:border-[#c23c2a] hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selectedHero?.id === hero.id ? 'border-[#c23c2a] ring-2 ring-[#c23c2a]/40' : ''
                }`}
              >
                <img
                  src={hero.image}
                  alt={hero.name}
                  className={`absolute inset-0 h-full w-full object-cover ${pickedIds.has(hero.id) ? 'grayscale' : ''}`}
                />
                <div className="relative z-10 w-full bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2">
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#9aa0a8]">
                    {hero.attribute === 'str' ? 'Strength' : hero.attribute === 'agi' ? 'Agility' : 'Intelligence'}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white">{hero.name}</div>
                </div>
              </button>
            ))}
            {filteredHeroes.length === 0 && (
              <div className="col-span-4 rounded-md border border-dashed border-[#3b3f48] bg-[#101218]/70 p-6 text-center text-xs uppercase tracking-[0.25em] text-[#737983]">
                No heroes found for this filter.
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-6 rounded-xl border border-[#343943] bg-[#111318]/85 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#9aa0a8]">Hero Preview</div>
              <div className="font-[Cinzel] text-2xl uppercase tracking-[0.3em] text-[#f7e7c0]">
                {heroPreview.name}
              </div>
            </div>
            <div
              className={`rounded-md border px-3 py-1 text-xs uppercase tracking-[0.3em] ${
                heroPreview.attribute === 'str'
                  ? 'border-[#8b2f2f] text-[#f2c2c2]'
                  : heroPreview.attribute === 'agi'
                  ? 'border-[#2f8b4b] text-[#c2f2d2]'
                  : 'border-[#2f4c8b] text-[#c2d2f2]'
              }`}
            >
              {heroPreview.attribute.toUpperCase()}
            </div>
          </div>

          <div className="relative h-64 overflow-hidden rounded-lg border border-[#2a2d33] bg-gradient-to-b from-black/10 to-black/50">
            <img
              src={heroPreview.render}
              alt={heroPreview.name}
              className="absolute bottom-0 left-1/2 h-full -translate-x-1/2 object-contain"
            />
          </div>

          <p className="text-sm italic text-[#b7bbc2]">
            A legend forged in the eternal battlefield, {heroPreview.name} answers the call of the Ancients.
          </p>

          <div className="grid grid-cols-3 gap-3 text-xs uppercase tracking-[0.2em] text-[#9aa0a8]">
            <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
              Damage
              <div className="text-base font-semibold text-white">{heroPreview.stats.damage}</div>
            </div>
            <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
              Armor
              <div className="text-base font-semibold text-white">{heroPreview.stats.armor}</div>
            </div>
            <div className="rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 px-3 py-2">
              Speed
              <div className="text-base font-semibold text-white">{heroPreview.stats.speed}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {heroPreview.abilities.map((ability) => (
              <div
                key={ability.name}
                className="relative rounded-md border border-[#2a2d33] bg-[#0c0e12]/80 p-3 text-[10px] uppercase tracking-[0.2em] text-[#c8ccd4]"
                title={`${ability.name} - ${ability.cooldown}s`}
              >
                <div className="font-semibold text-white">{ability.name}</div>
                <div className="text-[9px] text-[#7f848c]">CD {ability.cooldown}s</div>
              </div>
            ))}
          </div>

          <button
            onClick={handleLockIn}
            disabled={!selectedHero || lockedHero !== null}
            className="mt-auto w-full rounded-md border border-[#c23c2a] bg-gradient-to-r from-[#4b1411] via-[#8b2f24] to-[#c23c2a] py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Lock In
          </button>
        </aside>
      </div>
    </div>
  );
};

export default HeroSelectionScreen;
