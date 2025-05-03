import type { ChatInputCommandInteraction } from 'discord.js';
import type { Model } from 'sequelize';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

export interface UserAttributes {
    discordId: string;
    homeAddress: string;
    homeLatitude: number;
    homeLongitude: number;
    notificationsEnabled: boolean;
}

export interface WorkLocationAttributes {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
}

export interface WorkScheduleAttributes {
    id: number;
    userId: string;
    workLocationId: number;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
}

export interface CarpoolGroupAttributes {
    id: number;
    name: string;
    workLocationId: number;
    maxSize: number;
}

export interface CarpoolMemberAttributes {
    id: number;
    userId: string;
    carpoolGroupId: number;
    isOrganizer: boolean;
}

export interface LocationRole {
    id: number;
    name: string;
    type: 'city' | 'district' | 'office';
    parentId?: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserLocationRole {
    id: number;
    userId: string;
    locationRoleId: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface LocationRoleAttributes {
    id?: number;
    name: string;
    type: 'city' | 'district' | 'office';
    parentId?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface UserLocationRoleAttributes {
    id?: number;
    userId: string;
    locationRoleId: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface UserInstance extends Model<UserAttributes>, UserAttributes {}
export interface WorkLocationInstance extends Model<WorkLocationAttributes>, WorkLocationAttributes {}
export interface WorkScheduleInstance extends Model<WorkScheduleAttributes>, WorkScheduleAttributes {}
export interface CarpoolGroupInstance extends Model<CarpoolGroupAttributes>, CarpoolGroupAttributes {}
export interface CarpoolMemberInstance extends Model<CarpoolMemberAttributes>, CarpoolMemberAttributes {} 