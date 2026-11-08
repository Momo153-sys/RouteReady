import { describe, expect, it } from 'vitest';
import { parseOSMTransit } from './osm-parser';

describe('parseOSMTransit', () => {
  it('extracts routes and preserves ordered stops', () => {
    const xml = `
      <osm>
        <node id="1" lat="41.01" lon="28.97">
          <tag k="name" v="Bağcılar"/>
        </node>
        <node id="2" lat="41.02" lon="28.98">
          <tag k="name" v="Kabataş"/>
        </node>
        <relation id="151819">
          <member type="node" ref="1" role="stop"/>
          <member type="node" ref="2" role="stop"/>
          <tag k="ref" v="T1"/>
          <tag k="name" v="T1: Bağcılar → Kabataş"/>
          <tag k="route" v="tram"/>
          <tag k="type" v="route"/>
        </relation>
      </osm>
    `;

    const result = parseOSMTransit(xml);

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0].ref).toBe('T1');
    expect(result.routes[0].stopIds).toEqual(['osm:1', 'osm:2']);
    expect(result.stops).toHaveLength(2);
    expect(result.stops[0].name).toBe('Bağcılar');
  });
});