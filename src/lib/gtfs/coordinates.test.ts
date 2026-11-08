
import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from './coordinates';

describe('normalizeCoordinate', () => {
  it('normalizes IETT latitude values', () => {
    expect(
      normalizeCoordinate('410.104.540.005.549', 'latitude')
    ).toBeCloseTo(41.0104540005549, 12);
  });

  it('normalizes IETT longitude values', () => {
    expect(
      normalizeCoordinate('286.843.529.999.755', 'longitude')
    ).toBeCloseTo(28.6843529999755, 12);
  });

  it('supports standard decimal coordinates', () => {
    expect(
      normalizeCoordinate('41.010675', 'latitude')
    ).toBe(41.010675);
  });

  it('rejects corrupted coordinate values', () => {
    expect(() =>
      normalizeCoordinate(
        '41.00506785536913:17 17.03.20268',
        'latitude'
      )
    ).toThrow('Invalid latitude');
  });

  it('rejects coordinates outside the valid range', () => {
    expect(() =>
      normalizeCoordinate('910.000', 'latitude')
    ).toThrow('latitude is outside the valid range');
  });

  it('rejects empty values', () => {
    expect(() =>
      normalizeCoordinate('', 'latitude')
    ).toThrow('Invalid latitude');
  });

  it('normalizes an Istanbul stop coordinate pair into plausible ranges', () => {
  const latitude = normalizeCoordinate(
    '410.191.700.005.564',
    'latitude'
  );

  const longitude = normalizeCoordinate(
    '286.843.529.999.755',
    'longitude'
  );

  expect(latitude).toBeGreaterThan(40);
  expect(latitude).toBeLessThan(42);

  expect(longitude).toBeGreaterThan(28);
  expect(longitude).toBeLessThan(30);
});


it('accepts integer coordinates', () => {
  expect(normalizeCoordinate('41', 'latitude')).toBe(41);
  expect(normalizeCoordinate('28', 'longitude')).toBe(28);
});
});
