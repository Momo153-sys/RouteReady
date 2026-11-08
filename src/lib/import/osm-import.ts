import { getDatabase } from '../../database/dexie';
import { parseOSMTransit } from './osm-parser';

export async function importOSMTransit(xml: string): Promise<{
  routes: number;
  stops: number;
}> {
  const data = parseOSMTransit(xml);
  const db = getDatabase();

  await db.transaction('rw', [db.osmStops, db.osmRoutes], async () => {
    await db.osmStops.clear();
    await db.osmRoutes.clear();

    await db.osmStops.bulkPut(data.stops);
    await db.osmRoutes.bulkPut(data.routes);
  });

  return {
    routes: data.routes.length,
    stops: data.stops.length,
  };
}