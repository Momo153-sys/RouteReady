
import Papa from 'papaparse';

export interface CsvParseOptions {
  delimiter?: ',' | ';';
}

export interface CsvParseResult<T> {
  data: T[];
  errors: string[];
}

export function parseCsv<T extends Record<string, string>>(
  content: string,
  options: CsvParseOptions = {}
): CsvParseResult<T> {
  const normalizedContent = content
    .replace(/^\uFEFF/, '')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/\r\n?/g, '\n');

  const result = Papa.parse<Record<string, string>>(normalizedContent, {
    header: true,
    delimiter: options.delimiter ?? '',
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.trim(),
    transform: (value) => value.trim(),
  });

  const headers = result.meta.fields ?? [];

  const validHeaders = headers.filter((header) => header !== '');

  const data = result.data.map((record) => {
    const cleanedRecord: Record<string, string> = {};

    for (const header of validHeaders) {
      cleanedRecord[header] = record[header] ?? '';
    }

    return cleanedRecord as T;
  });

  const errors = result.errors.map(
    (error) => `Row ${error.row ?? 'unknown'}: ${error.message}`
  );

  return {
    data,
    errors,
  };
}
