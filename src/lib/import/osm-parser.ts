
import { XMLParser } from 'fast-xml-parser';

export interface OSMStop {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  description?: string;
}

export interface OSMRoute {
  id: string;
  ref: string;
  name: string;
  type: string;
  stopIds: string[];
}

export interface OSMTransitData {
  stops: OSMStop[];
  routes: OSMRoute[];
}

type OSMElement = {
  '@_id'?: string;
  '@_lat'?: string;
  '@_lon'?: string;
  '@_k'?: string;
  '@_v'?: string;
  '@_role'?: string;
  '@_ref'?: string;
  tag?: OSMElement | OSMElement[];
  member?: OSMElement | OSMElement[];
  node?: OSMElement | OSMElement[];
  relation?: OSMElement | OSMElement[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    ['node', 'relation', 'member', 'tag'].includes(name),
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function getTags(
  value: OSMElement | OSMElement[] | undefined,
): Record<string, string> {
  const tags: Record<string, string> = {};

  for (const tag of asArray(value)) {
    if (tag?.['@_k'] && tag?.['@_v']) {
      tags[tag['@_k']] = tag['@_v'];
    }
  }

  return tags;
}

function getRouteLabel(route: OSMRoute): string {
  if (route.type === 'train' && route.ref === 'B1') {
    return 'Marmaray';
  }

  if (route.type === 'bus') {
    return 'Metrobüs';
  }

  const line = route.ref || route.name;

  const modeLabels: Record<string, string> = {
    subway: 'Metro',
    tram: 'Tram',
    light_rail: 'Light rail',
    funicular: 'Funicular',
    ferry: 'Ferry',
    train: 'Train',
  };

  return `${line} ${modeLabels[route.type] ?? 'Transit'}`;
}

export function parseOSMTransit(xml: string): OSMTransitData {
  const parsed = parser.parse(xml);
  const osm = parsed.osm;

  const nodes = new Map<string, OSMStop>();

  for (const node of asArray<OSMElement>(osm.node)) {
    const tags = getTags(node.tag);
    const id = String(node['@_id']);
    const latitude = Number(node['@_lat']);
    const longitude = Number(node['@_lon']);

    if (
      !tags.name ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    nodes.set(id, {
      id: `osm:${id}`,
      name: tags.name,
      latitude,
      longitude,
    });
  }

  const routes: OSMRoute[] = [];
  const usedStopIds = new Set<string>();

  for (const relation of asArray<OSMElement>(osm.relation)) {
    const tags = getTags(relation.tag);
    const type = tags.route;

    const supportedTypes = [
      'subway',
      'tram',
      'light_rail',
      'funicular',
      'ferry',
      'train',
      'bus',
    ];

    if (!supportedTypes.includes(type)) {
      continue;
    }

    // Only import actual Metrobüs services, not ordinary IETT feeder buses.
    if (
      type === 'bus' &&
      tags.network?.trim().toLowerCase() !== 'metrobus'
    ) {
      continue;
    }

    // Keep commuter rail, especially Marmaray, not intercity trains.
    if (
      type === 'train' &&
      tags.service !== 'commuter' &&
      !tags.network?.toLowerCase().includes('marmaray') &&
      tags.ref !== 'B1'
    ) {
      continue;
    }

    const stopIds = asArray<OSMElement>(relation.member)
      .filter((member) =>
        ['stop', 'stop_entry_only', 'stop_exit_only'].includes(
          member['@_role'] ?? '',
        ),
      )
      .map((member) => String(member['@_ref']))
      .filter((id) => nodes.has(id));

    if (stopIds.length < 2) continue;

    const id = String(relation['@_id']);

    const route: OSMRoute = {
      id: `osm:${id}`,
      ref: tags.ref ?? '',
      name: tags.name ?? tags.ref ?? `OSM route ${id}`,
      type,
      stopIds: stopIds.map((stopId) => `osm:${stopId}`),
    };

    routes.push(route);

    stopIds.forEach((stopId) => usedStopIds.add(stopId));
  }

  // Associate every stop with the transport lines serving it.
  const stopLines = new Map<string, Set<string>>();

  for (const route of routes) {
    const label = getRouteLabel(route);

    for (const stopId of route.stopIds) {
      const rawId = stopId.replace('osm:', '');

      if (!stopLines.has(rawId)) {
        stopLines.set(rawId, new Set());
      }

      stopLines.get(rawId)!.add(label);
    }
  }

  const stops = [...usedStopIds]
    .map((id) => {
      const stop = nodes.get(id);
      if (!stop) return null;

      const lines = [...(stopLines.get(id) ?? [])];

      return {
        ...stop,
        description: lines.length > 0
          ? `Lines: ${lines.join(', ')}`
          : undefined,
      };
    })
    .filter((stop): stop is NonNullable<typeof stop> => stop !== null);

  return { routes, stops };
}
