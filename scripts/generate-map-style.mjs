import fs from 'node:fs';
import { osm } from '@versatiles/style';

const tileJSON = {
  tilejson: '3.0.0',
  name: 'Istanbul Offline Map',
  scheme: 'tms',
  format: 'pbf',
  minzoom: 10,
  maxzoom: 14,
  bounds: [
    28.57485,
    40.911289,
    29.42203,
    41.325995,
  ],
  tiles: ['mbtiles://istanbul/{z}/{x}/{y}.pbf'],
  vector_layers: [
    { id: 'streets', fields: {} },
    { id: 'public_transport', fields: {} },
    { id: 'place_labels', fields: {} },
    { id: 'buildings', fields: {} },
    { id: 'pois', fields: {} },
    { id: 'ferries', fields: {} },
    { id: 'water_polygons', fields: {} },
    { id: 'street_labels', fields: {} },
  ],
};

const style = osm.tileset.build(tileJSON, {
  base: '',
  glyphsPattern: './fonts/{fontstack}/{range}.pbf',
  sprite: [
  {
    id: 'base',
    url: './sprites/base',
  },
  {
    id: 'extras',
    url: './sprites/extras',
  },
  {
    id: 'icons',
    url: './sprites/icons',
  },
],
});

style.name = 'RouteReady Istanbul Offline';

fs.writeFileSync(
  'public/maps/style.json',
  JSON.stringify(style, null, 2),
);

console.log('Offline map style generated.');
console.log('Sprite:', style.sprite);
console.log('Glyphs:', style.glyphs);