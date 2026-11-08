
import { getDatabase } from '../../database/dexie';
import { importOSMTransit } from './osm-import';

export async function loadOSMTransit(
  forceRefresh = false,
): Promise<void> {
  const db = getDatabase();

  if (!forceRefresh && (await db.osmRoutes.count()) > 0) {
    return;
  }

  const response = await fetch('/data/istanbul-transit.osm');

  if (!response.ok) {
    throw new Error('Failed to load Istanbul transit data');
  }

  const xml = await response.text();
  await importOSMTransit(xml);
}
