export type BoatModelId = 'divingBoat' | 'zodiacBoat';
export type IslandModelId = 'boathouseIsland' | 'lighthouseIsland';
export type LegacyBoatModelId = 'fishingBoat';

export interface ObjectModelOption<T extends string> {
  id: T;
  label: string;
}

export const BOAT_MODEL_OPTIONS: readonly ObjectModelOption<BoatModelId>[] = [
  { id: 'divingBoat', label: 'Fishing Boat' },
  { id: 'zodiacBoat', label: 'Zodiac Boat' },
] as const;

export const ISLAND_MODEL_OPTIONS: readonly ObjectModelOption<IslandModelId>[] = [
  { id: 'boathouseIsland', label: 'Boathouse Island' },
  { id: 'lighthouseIsland', label: 'Lighthouse Island' },
] as const;

export function isBoatModelId(value: string): value is BoatModelId {
  return value === 'divingBoat' || value === 'zodiacBoat';
}

export function normalizeBoatModelId(value: string): BoatModelId | null {
  if (isBoatModelId(value)) {
    return value;
  }

  // Backward compatibility for older shared links/local state.
  if (value === 'fishingBoat') {
    return 'divingBoat';
  }

  return null;
}

export function isIslandModelId(value: string): value is IslandModelId {
  return value === 'boathouseIsland' || value === 'lighthouseIsland';
}