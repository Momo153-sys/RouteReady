
import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv-parser';

describe('parseCsv', () => {
  it('parses comma-separated files', () => {
    const csv = `id,name
1,IETT
2,Metro`;

    const result = parseCsv(csv);
    console.log('CSV parser result:', result);

    expect(result.data).toEqual([
      { id: '1', name: 'IETT' },
      { id: '2', name: 'Metro' },
    ]);

    expect(result.errors).toHaveLength(0);
  });

  it('parses semicolon-separated files', () => {
    const csv = `stop_id;stop_name
292235;RIFAT ILGAZ CADDESİ
292236;UZUNYAYLA`;

    const result = parseCsv(csv, {
      delimiter: ';',
    });

    expect(result.data).toEqual([
      {
        stop_id: '292235',
        stop_name: 'RIFAT ILGAZ CADDESİ',
      },
      {
        stop_id: '292236',
        stop_name: 'UZUNYAYLA',
      },
    ]);
  });

  it('trims whitespace from headers and values', () => {
    const csv = ` id , name
 1 , IETT `;

    const result = parseCsv(csv);

    expect(result.data).toEqual([
      { id: '1', name: 'IETT' },
    ]);
  });

  it('preserves empty fields', () => {
    const csv = `id,name,description
1,IETT,
2,Metro,Additional information`;

    const result = parseCsv(csv);

    expect(result.data[0]).toEqual({
      id: '1',
      name: 'IETT',
      description: '',
    });
  });

  it('handles quoted fields containing delimiters', () => {
    const csv = `id,name
1,"KADIKÖY, KİRAZLITEPE"`;

    const result = parseCsv(csv);

    expect(result.data[0].name).toBe(
      'KADIKÖY, KİRAZLITEPE'
    );
  });

  it('skips empty lines', () => {
    const csv = `id,name
1,IETT

2,Metro`;

    const result = parseCsv(csv);

    expect(result.data).toHaveLength(2);
  });

  it('ignores trailing empty columns', () => {
  const csv = [
    'stop_id;stop_name;',
    '292235;RIFAT ILGAZ CADDESİ;',
    '292236;UZUNYAYLA;',
  ].join('\n');

  const result = parseCsv(csv, { delimiter: ';' });

  expect(result.data).toHaveLength(2);
  expect(result.data[0]).toEqual({
    stop_id: '292235',
    stop_name: 'RIFAT ILGAZ CADDESİ',
  });
  expect(Object.keys(result.data[0])).toEqual([
    'stop_id',
    'stop_name',
  ]);
});


it('removes UTF-8 BOM from the beginning of the file', () => {
  const csv = '\uFEFFroute_id,route_short_name\n1,1';

  const result = parseCsv(csv);

  expect(result.data).toEqual([
    {
      route_id: '1',
      route_short_name: '1',
    },
  ]);

  expect(Object.keys(result.data[0])).toEqual([
    'route_id',
    'route_short_name',
  ]);
});

});
