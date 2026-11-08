
import { getDatabase } from '../database/dexie';
import type { Agency } from '../domain/agencies';

export async function saveAgency(agency: Agency): Promise<void> {
  await getDatabase().agencies.put(agency);
}

export async function getAgencyById(
  id: string
): Promise<Agency | null> {
  return (await getDatabase().agencies.get(id)) ?? null;
}

export async function saveAgencies(agencies: Agency[]): Promise<void> {
  if (agencies.length === 0) return;

  await getDatabase().agencies.bulkPut(agencies);
}
