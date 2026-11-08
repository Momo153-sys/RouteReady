
import { getDatabase } from '../database/dexie';
import type {
  ServiceCalendar,
  ServiceException,
} from '../domain/services';

export async function saveService(
  serviceId: string
): Promise<void> {
  await getDatabase().services.put({ serviceId });
}

export async function saveServices(
  serviceIds: string[]
): Promise<void> {
  if (serviceIds.length === 0) return;

  await getDatabase().services.bulkPut(
    serviceIds.map((serviceId) => ({ serviceId }))
  );
}

export async function saveServiceCalendar(
  calendar: ServiceCalendar
): Promise<void> {
  await getDatabase().serviceCalendars.put(calendar);
}

export async function saveServiceCalendars(
  calendars: ServiceCalendar[]
): Promise<void> {
  if (calendars.length === 0) return;

  await getDatabase().serviceCalendars.bulkPut(calendars);
}

export async function saveServiceException(
  exception: ServiceException
): Promise<void> {
  await getDatabase().serviceExceptions.put(exception);
}

export async function getServiceCalendar(
  serviceId: string
): Promise<ServiceCalendar | null> {
  return (
    (await getDatabase().serviceCalendars.get(serviceId)) ?? null
  );
}

export async function getServiceExceptions(
  serviceId: string
): Promise<ServiceException[]> {
  return getDatabase()
    .serviceExceptions
    .where('serviceId')
    .equals(serviceId)
    .sortBy('date');
}
