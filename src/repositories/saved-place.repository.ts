
import { getDatabase } from '../database/dexie';

export interface SavedPlace {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export async function savePlace(
  place: SavedPlace
): Promise<void> {
  await getDatabase().savedPlaces.put(place);
}

export async function getAllSavedPlaces(): Promise<SavedPlace[]> {
  return getDatabase().savedPlaces.orderBy('name').toArray();
}

export async function deleteSavedPlace(
  id: string
): Promise<void> {
  await getDatabase().savedPlaces.delete(id);
}
