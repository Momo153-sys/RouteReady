
export type CoordinateAxis = 'latitude' | 'longitude';

export function normalizeCoordinate(
  value: string,
  axis: CoordinateAxis
): number {
  const trimmed = value.trim();

  if (!/^-?\d+(?:\.\d+)*$/.test(trimmed)) {
    throw new Error(`Invalid ${axis}: ${value}`);
  }

  let coordinate: number;

  // First, try standard decimal notation.
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
  coordinate = Number(trimmed);
} else {
    // The IETT dataset sometimes inserts periods
    // as grouping separators.
    const negative = trimmed.startsWith('-');
    const digits = trimmed.replace(/[-.]/g, '');

    if (digits.length < 3) {
      throw new Error(`Invalid ${axis}: ${value}`);
    }

    coordinate = Number(
      `${negative ? '-' : ''}${digits.slice(0, 2)}.${digits.slice(2)}`
    );
  }

  if (!Number.isFinite(coordinate)) {
    throw new Error(`Invalid ${axis}: ${value}`);
  }

  const limit = axis === 'latitude' ? 90 : 180;

  if (Math.abs(coordinate) > limit) {
    throw new Error(`${axis} is outside the valid range: ${value}`);
  }

  return coordinate;
}
