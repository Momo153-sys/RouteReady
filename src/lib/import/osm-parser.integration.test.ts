import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseOSMTransit } from './osm-parser';

describe('OSM Istanbul integration', () => {
  it('parses the actual Istanbul transit dataset', () => {
    const xml = readFileSync(
      resolve(process.cwd(), 'routeready-rail-ferry.osm'),
      'utf-8',
    );

    const result = parseOSMTransit(xml);

    expect(result.routes.length).toBeGreaterThan(0);
    expect(result.stops.length).toBeGreaterThan(0);

    expect(result.routes.some((route) => route.ref === 'T1')).toBe(true);
    expect(result.routes.some((route) => route.type === 'subway')).toBe(true);
    expect(result.routes.some((route) => route.type === 'ferry')).toBe(true);

    for (const route of result.routes) {
      expect(route.stopIds.length).toBeGreaterThanOrEqual(2);
    }

    console.log('OSM routes:', result.routes.length);
    console.log('OSM stops:', result.stops.length);
    console.log(
      'Route types:',
      [...new Set(result.routes.map((route) => route.type))],
    );
  });
});