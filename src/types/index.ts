import { DateTime } from 'luxon';

export interface User {
    discordId: string;
    homeAddress: string;
    homeLatitude: number;
    homeLongitude: number;
}

export interface WorkLocation {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface WorkSchedule {
    id: number;
    userId: string;
    workLocationId: number;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
}

export interface CarpoolGroup {
    id: number;
    name: string;
    workLocationId: number;
    maxSize: number;
}

export interface CarpoolMember {
    id: number;
    carpoolGroupId: number;
    userId: string;
    isDriver: boolean;
}

export interface CommandHandler {
    (message: any, args: string[]): Promise<void>;
}

export interface TimeRange {
    start: DateTime;
    end: DateTime;
}

export interface WorkDay {
    day: number; // 1-7 (Monday-Sunday)
    timeRange: TimeRange;
} 