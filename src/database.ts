import { Sequelize, DataTypes, Model } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import type {
    UserInstance,
    WorkLocationInstance,
    WorkScheduleInstance,
    CarpoolGroupInstance,
    CarpoolMemberInstance,
    LocationRoleInstance,
    UserLocationRoleInstance
} from './types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: false,
});

// Define models with proper types
export const User = sequelize.define<UserInstance>('User', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    discordId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    homeAddress: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    homeLatitude: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    homeLongitude: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    notificationsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'users',
});

export const WorkLocation = sequelize.define<WorkLocationInstance>('WorkLocation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    latitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    longitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'work_locations',
});

export const WorkSchedule = sequelize.define<WorkScheduleInstance>('WorkSchedule', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    workLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'work_locations',
            key: 'id',
        },
    },
    startTime: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    endTime: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    daysOfWeek: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'work_schedules',
});

export const CarpoolGroup = sequelize.define<CarpoolGroupInstance>('CarpoolGroup', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    workLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'work_locations',
            key: 'id',
        },
    },
    maxSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 4,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'carpool_groups',
});

export const CarpoolMember = sequelize.define<CarpoolMemberInstance>('CarpoolMember', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    carpoolGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'carpool_groups',
            key: 'id',
        },
    },
    isOrganizer: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'carpool_members',
});

export const LocationRole = sequelize.define<LocationRoleInstance>('LocationRole', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM('city', 'district', 'office'),
        allowNull: false,
    },
    parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'location_roles',
            key: 'id',
        },
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'location_roles',
});

export const UserLocationRole = sequelize.define<UserLocationRoleInstance>('UserLocationRole', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id',
        },
    },
    locationRoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'location_roles',
            key: 'id',
        },
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
}, {
    tableName: 'user_location_roles',
});

// Setup database and sync models
export async function setupDatabase(): Promise<void> {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Define relationships
        User.hasMany(WorkSchedule, { foreignKey: 'userId' });
        WorkSchedule.belongsTo(User, { foreignKey: 'userId' });

        WorkLocation.hasMany(WorkSchedule, { foreignKey: 'workLocationId' });
        WorkSchedule.belongsTo(WorkLocation, { foreignKey: 'workLocationId' });

        WorkLocation.hasMany(CarpoolGroup, { foreignKey: 'workLocationId' });
        CarpoolGroup.belongsTo(WorkLocation, { foreignKey: 'workLocationId' });

        // Add CarpoolGroup and CarpoolMember associations
        CarpoolGroup.hasMany(CarpoolMember, { foreignKey: 'carpoolGroupId' });
        CarpoolMember.belongsTo(CarpoolGroup, { foreignKey: 'carpoolGroupId' });
        CarpoolMember.belongsTo(User, { foreignKey: 'userId' });
        User.hasMany(CarpoolMember, { foreignKey: 'userId' });

        // Location role relationships
        LocationRole.hasMany(LocationRole, { foreignKey: 'parentId', as: 'childRoles' });
        LocationRole.belongsTo(LocationRole, { foreignKey: 'parentId', as: 'parentRole' });

        LocationRole.hasMany(UserLocationRole, { foreignKey: 'locationRoleId' });
        UserLocationRole.belongsTo(LocationRole, { foreignKey: 'locationRoleId' });

        User.hasMany(UserLocationRole, { foreignKey: 'userId' });
        UserLocationRole.belongsTo(User, { foreignKey: 'userId' });

        // First sync with force: true to ensure clean tables
        await sequelize.sync({ force: true });
        console.log('Database models synchronized successfully with force option.');

        // Subsequent syncs will use alter: true
        sequelize.options.sync = { alter: true };
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

export { sequelize }; 