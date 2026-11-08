export interface ServiceCalendar {
  serviceId: string;
  serviceName: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  startDate: string;
  endDate: string;
}

export interface ServiceException {
  serviceId: string;
  date: string;
  exceptionType: 'added' | 'removed';
}