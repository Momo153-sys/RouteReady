import * as maplibregl from 'maplibre-gl';
import { getOfflineTile } from './mbtiles';

const PROTOCOL = 'mbtiles';

let isRegistered = false;

export function registerOfflineMapProtocol(): void {
  console.log('[OfflineMap] Registering protocol');
  if (isRegistered) return;

  maplibregl.addProtocol(
    PROTOCOL,
    async (requestParameters, abortController) => {
      if (abortController.signal.aborted) {
        throw new Error('Tile request aborted.');
      }

      console.log('[OfflineMap] Tile requested:', requestParameters.url);

      const match = requestParameters.url.match(
        /^mbtiles:\/\/istanbul\/(\d+)\/(\d+)\/(\d+)\.pbf$/,
      );

      if (!match) {
        throw new Error('Invalid offline tile URL.');
      }

      const [, z, x, y] = match;

      const tile = await getOfflineTile(
        Number(z),
        Number(x),
        Number(y),
      );

      if (!tile) {
        throw new Error(
          `Offline tile not found: ${z}/${x}/${y}`,
        );
      }

      if (abortController.signal.aborted) {
        throw new Error('Tile request aborted.');
      }

      return {
        data: tile.data.slice().buffer as ArrayBuffer,
      };
    },
  );

  isRegistered = true;
}