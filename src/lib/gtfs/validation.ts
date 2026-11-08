
export interface ValidationResult<T> {
  validRecords: T[];
  errors: string[];
}

export function validateRequiredFields<
  T extends Record<string, string>
>(
  records: T[],
  requiredFields: (keyof T)[]
): ValidationResult<T> {
  const validRecords: T[] = [];
  const errors: string[] = [];

  records.forEach((record, index) => {
    const missingFields = requiredFields.filter((field) => {
      const value = record[field];

      return value === undefined || value.trim() === '';
    });

    if (missingFields.length > 0) {
      errors.push(
        `Row ${index + 1}: missing required fields: ${missingFields.join(', ')}`
      );

      return;
    }

    validRecords.push(record);
  });

  return {
    validRecords,
    errors,
  };
}

export function isValidGtfsDate(value: string): boolean {
  if (!/^\d{8}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));

  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidGtfsDateRange(
  startDate: string,
  endDate: string
): boolean {
  if (!isValidGtfsDate(startDate) || !isValidGtfsDate(endDate)) {
    return false;
  }

  return startDate <= endDate;
}

export function isValidGtfsWeekdayFlag(value: string): boolean {
  return value === '0' || value === '1';
}
export function isValidStopSequence(value: string): boolean {
  const sequence = Number(value);

  return (
    value.trim() !== '' &&
    Number.isInteger(sequence) &&
    sequence > 0
  );
}

export function isValidTimepoint(value: string): boolean {
  return value === '0' || value === '1';
}

export function isValidDirectionId(value: string): boolean {
  return value === '' || value === '0' || value === '1';
}

export function isValidLocationType(value: string): boolean {
  return ['0', '1', '2', '3', '4'].includes(value);
}

export function isValidRouteType(value: string): boolean {
  return ['0', '1', '2', '3', '4'].includes(value);
}

export function isValidGtfsTime(value: string): boolean {
  return /^\d+:[0-5]\d:[0-5]\d$/.test(value);
}