import type { ChatInputCommandInteraction } from 'discord.js';
import { type Model, type Optional } from 'sequelize';

export type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<void>;

export interface UserAttributes {
    id: string;
    discordId: string;
    homeAddress: string;
    homeLatitude: number;
    homeLongitude: number;
    notificationsEnabled: boolean;
    // Profile data
    username: string;
    avatar: string | null;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string | null;
    accent_color: number;
    global_name: string;
    avatar_decoration_data: any | null;
    collectibles: any | null;
    banner_color: string;
    clan: any | null;
    primary_guild: any | null;
    mfa_enabled: boolean;
    locale: string;
    premium_type: number;
    email: string;
    verified: boolean;
    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkLocationAttributes {
    id: number;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface WorkScheduleAttributes {
    id: number;
    userId: string;
    workLocationId: number;
    startTime: string;
    endTime: string;
    daysOfWeek: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CarpoolGroupAttributes {
    id: number;
    name: string;
    workLocationId: number;
    maxSize: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface CarpoolMemberAttributes {
    id: number;
    userId: string;
    carpoolGroupId: number;
    isOrganizer: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface LocationRoleAttributes {
    id: number;
    name: string;
    type: 'city' | 'district' | 'office';
    parentId: number | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserLocationRoleAttributes {
    id: number;
    userId: string;
    locationRoleId: number;
    createdAt: Date;
    updatedAt: Date;
}

export type UserInstance = Model<UserAttributes, Optional<UserAttributes, 'id' | 'createdAt' | 'updatedAt'>> & UserAttributes;
export type WorkLocationInstance = Model<WorkLocationAttributes, Optional<WorkLocationAttributes, 'id' | 'createdAt' | 'updatedAt'>> & WorkLocationAttributes;
export type WorkScheduleInstance = Model<WorkScheduleAttributes, Optional<WorkScheduleAttributes, 'id' | 'createdAt' | 'updatedAt'>> & WorkScheduleAttributes;
export type CarpoolGroupInstance = Model<CarpoolGroupAttributes, Optional<CarpoolGroupAttributes, 'id' | 'createdAt' | 'updatedAt'>> & CarpoolGroupAttributes;
export type CarpoolMemberInstance = Model<CarpoolMemberAttributes, Optional<CarpoolMemberAttributes, 'id' | 'createdAt' | 'updatedAt'>> & CarpoolMemberAttributes;
export type LocationRoleInstance = Model<LocationRoleAttributes, Optional<LocationRoleAttributes, 'id' | 'createdAt' | 'updatedAt'>> & LocationRoleAttributes;
export type UserLocationRoleInstance = Model<UserLocationRoleAttributes, Optional<UserLocationRoleAttributes, 'id' | 'createdAt' | 'updatedAt'>> & UserLocationRoleAttributes;

export interface WorkScheduleWithLocation extends WorkScheduleInstance {
    WorkLocation: WorkLocationInstance;
}

export interface CarpoolGroupWithMembers extends CarpoolGroupInstance {
    WorkLocation: WorkLocationInstance;
    CarpoolMembers: (CarpoolMemberInstance & {
        User: UserInstance;
    })[];
}

export interface Profile {
    id: string;
    username: string;
    avatar: string | null;
    discriminator: string;
    public_flags: number;
    flags: number;
    banner: string | null;
    accent_color: number;
    global_name: string;
    avatar_decoration_data: any | null;
    collectibles: any | null;
    banner_color: string;
    clan: any | null;
    primary_guild: any | null;
    mfa_enabled: boolean;
    locale: string;
    premium_type: number;
    email: string;
    verified: boolean;
    provider: string;
    accessToken: string;
    fetchedAt: Date;
} 