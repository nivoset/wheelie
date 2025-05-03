import { Sequelize, DataTypes, Model, ModelStatic } from 'sequelize';
import path from 'path';
import { User, WorkLocation, WorkSchedule, CarpoolGroup, CarpoolMember } from './types';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../data/carpool.db'),
    logging: false
});

const UserModel = sequelize.define<Model<User>>('User', {
    discordId: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    homeAddress: {
        type: DataTypes.STRING,
        allowNull: false
    },
    homeLatitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    homeLongitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    }
});

const WorkLocationModel = sequelize.define<Model<WorkLocation>>('WorkLocation', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    latitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    longitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    }
});

const WorkScheduleModel = sequelize.define<Model<WorkSchedule>>('WorkSchedule', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    workLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    startTime: {
        type: DataTypes.TIME,
        allowNull: false
    },
    endTime: {
        type: DataTypes.TIME,
        allowNull: false
    },
    daysOfWeek: {
        type: DataTypes.STRING,
        allowNull: false
    }
});

const CarpoolGroupModel = sequelize.define<Model<CarpoolGroup>>('CarpoolGroup', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    workLocationId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    maxSize: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 4
    }
});

const CarpoolMemberModel = sequelize.define<Model<CarpoolMember>>('CarpoolMember', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    carpoolGroupId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isDriver: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
});

// Define relationships
UserModel.hasMany(WorkScheduleModel);
WorkScheduleModel.belongsTo(UserModel);
WorkLocationModel.hasMany(WorkScheduleModel);
WorkScheduleModel.belongsTo(WorkLocationModel);
WorkLocationModel.hasMany(CarpoolGroupModel);
CarpoolGroupModel.belongsTo(WorkLocationModel);
CarpoolGroupModel.hasMany(CarpoolMemberModel);
CarpoolMemberModel.belongsTo(CarpoolGroupModel);
UserModel.hasMany(CarpoolMemberModel);
CarpoolMemberModel.belongsTo(UserModel);

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
            model: 'LocationRoles',
            key: 'id',
        },
    },
}, {
    timestamps: true,
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
            model: 'Users',
            key: 'discordId',
        },
    },
    locationRoleId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'LocationRoles',
            key: 'id',
        },
    },
}, {
    timestamps: true,
});

// Add associations
LocationRole.hasMany(LocationRole, { as: 'children', foreignKey: 'parentId' });
LocationRole.belongsTo(LocationRole, { as: 'parent', foreignKey: 'parentId' });

UserLocationRole.belongsTo(UserModel, { foreignKey: 'userId' });
UserLocationRole.belongsTo(LocationRole, { foreignKey: 'locationRoleId' });

UserModel.hasMany(UserLocationRole, { foreignKey: 'userId' });
LocationRole.hasMany(UserLocationRole, { foreignKey: 'locationRoleId' });

async function setupDatabase(): Promise<void> {
    try {
        await sequelize.sync();
        console.log('Database synchronized successfully');
    } catch (error) {
        console.error('Error synchronizing database:', error);
    }
}

export {
    sequelize,
    UserModel as User,
    WorkLocationModel as WorkLocation,
    WorkScheduleModel as WorkSchedule,
    CarpoolGroupModel as CarpoolGroup,
    CarpoolMemberModel as CarpoolMember,
    setupDatabase
}; 