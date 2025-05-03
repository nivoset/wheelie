import { 
    Message, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    SlashCommandBuilder, 
    WebhookClient,
    SlashCommandSubcommandBuilder,
    SlashCommandStringOption,
    SlashCommandBooleanOption,
    SlashCommandIntegerOption,
    PermissionsBitField
} from 'discord.js';
import { User, WorkLocation, WorkSchedule, CarpoolGroup, CarpoolMember, LocationRole, UserLocationRole } from './database.js';
import NodeGeocoder from 'node-geocoder';
import { DateTime } from 'luxon';
import type { 
    CommandHandler,
    UserInstance,
    WorkLocationInstance,
    WorkScheduleInstance,
    CarpoolGroupInstance,
    CarpoolMemberInstance
} from './types.js';

const geocoder = NodeGeocoder({
    provider: 'openstreetmap'
});

// Initialize webhook client
const webhookClient = new WebhookClient({ url: process.env.WEBHOOK_URL || '' });

// Command definitions
export const commands = [
    new SlashCommandBuilder()
        .setName('pool')
        .setDescription('Manage your carpool settings')
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('set-home')
                .setDescription('Set your home address for carpool matching')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('address')
                        .setDescription('Your home address')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('set-work')
                .setDescription('Set your work location')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('name')
                        .setDescription('Name of the work location')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('address')
                        .setDescription('Address of the work location')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('set-schedule')
                .setDescription('Set your work schedule')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('location')
                        .setDescription('Name of the work location')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('starttime')
                        .setDescription('Start time (HH:mm)')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('endtime')
                        .setDescription('End time (HH:mm)')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('days')
                        .setDescription('Days of week (1-7, comma-separated)')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('find')
                .setDescription('Find available carpools matching your schedule'))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('stats')
                .setDescription('View carpool statistics'))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('notify')
                .setDescription('Set your notification preferences')
                .addBooleanOption((option: SlashCommandBooleanOption) =>
                    option.setName('enabled')
                        .setDescription('Enable/disable notifications')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('out')
                .setDescription('Notify your carpool about an absence')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('date')
                        .setDescription('Date of absence (YYYY-MM-DD)')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('reason')
                        .setDescription('Reason for absence')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('message')
                .setDescription('Send a message to your carpool group')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('text')
                        .setDescription('Your message')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('set-organizer')
                .setDescription('Set yourself as a carpool group organizer')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('group')
                        .setDescription('Name of the carpool group')
                        .setRequired(true))),
    new SlashCommandBuilder()
        .setName('pool-admin')
        .setDescription('Admin commands for carpool management')
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('create')
                .setDescription('Create a new carpool group')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('name')
                        .setDescription('Name of the carpool group')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('location')
                        .setDescription('Name of the work location')
                        .setRequired(true))
                .addIntegerOption((option: SlashCommandIntegerOption) =>
                    option.setName('max-size')
                        .setDescription('Maximum number of members')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('list')
                .setDescription('List all carpool groups'))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('announce')
                .setDescription('Send an announcement to all carpool members')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('message')
                        .setDescription('The announcement message')
                        .setRequired(true)))
];

const handleCreateCarpool = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const name = interaction.options.getString('name', true);
    const locationName = interaction.options.getString('location', true);
    const maxSize = interaction.options.getInteger('max-size', true);

    try {
        const workLocation = await WorkLocation.findOne({ where: { name: locationName } }) as WorkLocationInstance | null;
        if (!workLocation) {
            return interaction.reply({ 
                content: 'Work location not found. Please create the work location first.',
                ephemeral: true 
            });
        }

        await CarpoolGroup.create({
            name,
            workLocationId: workLocation.id,
            maxSize
        });

        interaction.reply({ 
            content: `Successfully created carpool group: ${name}`,
            ephemeral: true 
        });
    } catch (error) {
        console.error('Create carpool error:', error);
        interaction.reply({ 
            content: 'There was an error creating the carpool group. Please try again later.',
            ephemeral: true 
        });
    }
};

const handleListCarpools = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    try {
        const carpools = await CarpoolGroup.findAll({
            include: [
                { model: WorkLocation },
                { model: CarpoolMember, include: [User] }
            ]
        }) as (CarpoolGroupInstance & {
            WorkLocation: WorkLocationInstance;
            CarpoolMembers: (CarpoolMemberInstance & {
                User: UserInstance;
            })[];
        })[];

        const embed = new EmbedBuilder()
            .setTitle('Carpool Groups')
            .setColor('#0099ff');

        for (const carpool of carpools) {
            const members = carpool.CarpoolMembers
                .map((member: CarpoolMemberInstance & { User: UserInstance }) => member.User.discordId)
                .map((id: string) => `<@${id}>`)
                .join(', ');

            embed.addFields({
                name: `${carpool.name} (${carpool.WorkLocation.name})`,
                value: `Members: ${members || 'None'}\nSize: ${carpool.CarpoolMembers.length}/${carpool.maxSize}`
            });
        }

        interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('List carpools error:', error);
        interaction.reply({ 
            content: 'There was an error listing carpool groups. Please try again later.',
            ephemeral: true 
        });
    }
};

// Helper function to send notifications via webhook
async function sendNotification(userId: string, message: string, embed?: EmbedBuilder): Promise<void> {
    try {
        const user = await User.findByPk(userId) as UserInstance | null;
        if (user?.notificationsEnabled) {
            await webhookClient.send({
                content: `<@${userId}> ${message}`,
                embeds: embed ? [embed] : undefined
            });
        }
    } catch (error) {
        console.error('Error sending notification:', error);
    }
}

// Helper function to notify carpool members
async function notifyCarpoolMembers(carpoolId: string, message: string, embed?: EmbedBuilder): Promise<void> {
    try {
        const members = await CarpoolMember.findAll({
            where: { carpoolGroupId: carpoolId },
            include: [User]
        }) as (CarpoolMemberInstance & {
            User: UserInstance;
        })[];

        for (const member of members) {
            if (member.User.notificationsEnabled) {
                await sendNotification(member.User.discordId, message, embed);
            }
        }
    } catch (error) {
        console.error('Error notifying carpool members:', error);
    }
}

export const handleSetHome = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const address = interaction.options.getString('address', true);
    
    try {
        const geoResult = await geocoder.geocode(address);
        if (!geoResult.length) {
            return interaction.reply({ 
                content: 'Could not find the address. Please try again with a more specific address.',
                ephemeral: true 
            });
        }

        await User.create({
            discordId: interaction.user.id,
            homeAddress: address,
            homeLatitude: geoResult[0].latitude,
            homeLongitude: geoResult[0].longitude,
            notificationsEnabled: true // Enable notifications by default
        });

        interaction.reply({ 
            content: 'Successfully registered your home address! You can now set your work location and schedule.',
            ephemeral: true 
        });
    } catch (error) {
        console.error('Registration error:', error);
        interaction.reply({ 
            content: 'There was an error processing your registration. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleSetWork = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const name = interaction.options.getString('name', true);
    const address = interaction.options.getString('address', true);

    try {
        const geoResult = await geocoder.geocode(address);
        if (!geoResult.length) {
            return interaction.reply({ 
                content: 'Could not find the work address. Please try again with a more specific address.',
                ephemeral: true 
            });
        }

        await WorkLocation.create({
            name,
            address,
            latitude: geoResult[0].latitude,
            longitude: geoResult[0].longitude
        });

        interaction.reply({ 
            content: `Successfully set work location: ${name}`,
            ephemeral: true 
        });
    } catch (error) {
        console.error('Set work location error:', error);
        interaction.reply({ 
            content: 'There was an error setting your work location. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleSetSchedule = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const locationName = interaction.options.getString('location', true);
    const startTime = interaction.options.getString('starttime', true);
    const endTime = interaction.options.getString('endtime', true);
    const days = interaction.options.getString('days', true);

    try {
        const workLocation = await WorkLocation.findOne({ where: { name: locationName } });
        if (!workLocation) {
            return interaction.reply({ 
                content: 'Work location not found. Please set your work location first.',
                ephemeral: true 
            });
        }

        const startDateTime = DateTime.fromFormat(startTime, 'HH:mm');
        const endDateTime = DateTime.fromFormat(endTime, 'HH:mm');
        
        if (!startDateTime.isValid || !endDateTime.isValid) {
            return interaction.reply({ 
                content: 'Invalid time format. Please use 24-hour format (HH:mm)',
                ephemeral: true 
            });
        }

        const validDays = days.split(',').map(day => parseInt(day.trim()));
        if (!validDays.every(day => day >= 1 && day <= 7)) {
            return interaction.reply({ 
                content: 'Invalid days format. Please provide numbers 1-7 separated by commas (1=Monday, 7=Sunday)',
                ephemeral: true 
            });
        }

        await WorkSchedule.create({
            userId: interaction.user.id,
            workLocationId: workLocation.id,
            startTime: startDateTime.toFormat('HH:mm'),
            endTime: endDateTime.toFormat('HH:mm'),
            daysOfWeek: validDays.join(',')
        });

        interaction.reply({ 
            content: 'Successfully set your work schedule!',
            ephemeral: true 
        });
    } catch (error) {
        console.error('Set schedule error:', error);
        interaction.reply({ 
            content: 'There was an error setting your schedule. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleFindCarpool = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true 
            });
        }

        const workSchedules = await WorkSchedule.findAll({
            where: { userId: interaction.user.id },
            include: [WorkLocation]
        });

        if (!workSchedules.length) {
            return interaction.reply({ 
                content: 'Please set your work location and schedule first.',
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Available Carpools')
            .setDescription('React to join a carpool group!');

        for (const schedule of workSchedules) {
            const carpools = await CarpoolGroup.findAll({
                where: { workLocationId: schedule.workLocationId },
                include: [CarpoolMember]
            });

            for (const carpool of carpools) {
                if (carpool.CarpoolMembers.length < carpool.maxSize) {
                    embed.addFields({
                        name: `${schedule.WorkLocation.name} - ${carpool.name}`,
                        value: `${carpool.CarpoolMembers.length}/${carpool.maxSize} members`
                    });
                }
            }
        }

        const message = await interaction.reply({ 
            embeds: [embed],
            fetchReply: true 
        });

        // Add reactions for joining carpools
        // Implementation depends on your specific UI needs
    } catch (error) {
        console.error('Find carpool error:', error);
        interaction.reply({ 
            content: 'There was an error finding carpools. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleStats = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    try {
        const totalUsers = await User.count();
        const totalCarpools = await CarpoolGroup.count();
        const totalMembers = await CarpoolMember.count();

        const embed = new EmbedBuilder()
            .setTitle('Carpool Statistics')
            .addFields(
                { name: 'Total Users', value: totalUsers.toString(), inline: true },
                { name: 'Total Carpools', value: totalCarpools.toString(), inline: true },
                { name: 'Total Members', value: totalMembers.toString(), inline: true }
            );

        interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Stats error:', error);
        interaction.reply({ 
            content: 'There was an error retrieving statistics. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleNotify = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const enabled = interaction.options.getBoolean('enabled', true);
    
    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true 
            });
        }

        user.notificationsEnabled = enabled;
        await user.save();

        interaction.reply({ 
            content: `Notifications ${enabled ? 'enabled' : 'disabled'} successfully!`,
            ephemeral: true 
        });
    } catch (error) {
        console.error('Notification settings error:', error);
        interaction.reply({ 
            content: 'There was an error updating your notification settings. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleOut = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const date = interaction.options.getString('date', true);
    const reason = interaction.options.getString('reason', true);

    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true 
            });
        }

        // Find all carpools the user is in
        const memberships = await CarpoolMember.findAll({
            where: { userId: interaction.user.id },
            include: [CarpoolGroup]
        });

        if (!memberships.length) {
            return interaction.reply({ 
                content: 'You are not a member of any carpool groups.',
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Carpool Absence Notice')
            .setDescription(`${interaction.user.username} will be out on ${date}`)
            .addFields({ name: 'Reason', value: reason })
            .setColor('#ff0000')
            .setTimestamp();

        // Notify all carpool groups
        for (const membership of memberships) {
            await notifyCarpoolMembers(
                membership.carpoolGroupId,
                `🚫 ${interaction.user.username} will be out on ${date} (${reason})`,
                embed
            );
        }

        interaction.reply({ 
            content: 'Your absence has been notified to all your carpool groups.',
            ephemeral: true 
        });
    } catch (error) {
        console.error('Out notification error:', error);
        interaction.reply({ 
            content: 'There was an error sending your absence notification. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleMessage = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const message = interaction.options.getString('text', true);

    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                ephemeral: true 
            });
        }

        // Find all carpools the user is in
        const memberships = await CarpoolMember.findAll({
            where: { userId: interaction.user.id },
            include: [CarpoolGroup]
        });

        if (!memberships.length) {
            return interaction.reply({ 
                content: 'You are not a member of any carpool groups.',
                ephemeral: true 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Carpool Message')
            .setDescription(message)
            .setColor('#0099ff')
            .setFooter({ text: `From: ${interaction.user.username}` })
            .setTimestamp();

        // Notify all carpool groups
        for (const membership of memberships) {
            await notifyCarpoolMembers(
                membership.carpoolGroupId,
                `💬 ${interaction.user.username}: ${message}`,
                embed
            );
        }

        interaction.reply({ 
            content: 'Your message has been sent to all your carpool groups.',
            ephemeral: true 
        });
    } catch (error) {
        console.error('Message error:', error);
        interaction.reply({ 
            content: 'There was an error sending your message. Please try again later.',
            ephemeral: true 
        });
    }
};

const handleAnnounce = async (interaction: ChatInputCommandInteraction) => {
    const message = interaction.options.getString('message', true);
    
    try {
        const users = await User.findAll();
        const embed = new EmbedBuilder()
            .setTitle('Carpool Announcement')
            .setDescription(message)
            .setColor('#0099ff')
            .setTimestamp();

        for (const user of users) {
            if (user.notificationsEnabled) {
                await sendNotification(user.discordId, '', embed);
            }
        }

        interaction.reply({ 
            content: 'Announcement sent successfully!',
            ephemeral: true 
        });
    } catch (error) {
        console.error('Announcement error:', error);
        interaction.reply({ 
            content: 'There was an error sending the announcement. Please try again later.',
            ephemeral: true 
        });
    }
};

export const handleSetOrganizer = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const groupName = interaction.options.getString('group', true);
    
    try {
        // Check if user exists
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please register first using /pool set-home',
                ephemeral: true 
            });
        }

        // Find the carpool group
        const carpoolGroup = await CarpoolGroup.findOne({ where: { name: groupName } });
        if (!carpoolGroup) {
            return interaction.reply({ 
                content: 'Carpool group not found. Please check the group name and try again.',
                ephemeral: true 
            });
        }

        // Check if user is already a member
        const existingMember = await CarpoolMember.findOne({
            where: {
                userId: interaction.user.id,
                carpoolGroupId: carpoolGroup.id
            }
        });

        if (!existingMember) {
            return interaction.reply({ 
                content: 'You must be a member of the carpool group to become an organizer.',
                ephemeral: true 
            });
        }

        // Set user as organizer
        await existingMember.update({ isOrganizer: true });

        // Notify carpool members
        const embed = new EmbedBuilder()
            .setTitle('New Carpool Organizer')
            .setDescription(`${interaction.user.username} is now an organizer for ${groupName}`)
            .setColor('#00ff00')
            .setTimestamp();

        await notifyCarpoolMembers(carpoolGroup.id, `👑 ${interaction.user.username} is now an organizer for ${groupName}`, embed);

        interaction.reply({ 
            content: `You are now an organizer for ${groupName}!`,
            ephemeral: true 
        });
    } catch (error) {
        console.error('Set organizer error:', error);
        interaction.reply({ 
            content: 'There was an error setting you as an organizer. Please try again later.',
            ephemeral: true 
        });
    }
};

export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    const commandHandlers: Record<string, Record<string, CommandHandler>> = {
        pool: {
            'set-home': handleSetHome,
            'set-work': handleSetWork,
            'set-schedule': handleSetSchedule,
            'find': handleFindCarpool,
            'stats': handleStats,
            'notify': handleNotify,
            'out': handleOut,
            'message': handleMessage,
            'set-organizer': handleSetOrganizer
        },
        'pool-admin': {
            'create': handleCreateCarpool,
            'list': handleListCarpools,
            'announce': handleAnnounce
        }
    };

    const handler = commandHandlers[interaction.commandName]?.[interaction.options.getSubcommand()];
    if (handler) {
        await handler(interaction);
    }
}

export async function handleSetLocation(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            await interaction.reply({
                content: 'Please register first using /pool set-home',
                ephemeral: true,
            });
            return;
        }

        const locationType = interaction.options.getString('type', true) as 'city' | 'district' | 'office';
        const locationName = interaction.options.getString('name', true);
        const parentLocation = interaction.options.getString('parent');

        // Create or find the location role
        let locationRole = await LocationRole.findOne({
            where: { name: locationName, type: locationType }
        });

        if (!locationRole) {
            let parentId = null;
            if (parentLocation) {
                const parent = await LocationRole.findOne({
                    where: { name: parentLocation, type: locationType === 'district' ? 'city' : 'office' }
                });
                if (!parent) {
                    await interaction.reply({
                        content: `Parent location "${parentLocation}" not found. Please create it first.`,
                        ephemeral: true,
                    });
                    return;
                }
                parentId = parent.id;
            }

            locationRole = await LocationRole.create({
                name: locationName,
                type: locationType,
                parentId,
            });
        }

        // Assign the role to the user
        await UserLocationRole.create({
            userId: interaction.user.id,
            locationRoleId: locationRole.id,
        });

        // Create or update Discord role
        const roleName = `${locationType.toUpperCase()}: ${locationName}`;
        let role = interaction.guild?.roles.cache.find(r => r.name === roleName);
        
        if (!role) {
            // Get parent role for hierarchy
            let parentRole = null;
            if (parentLocation) {
                const parentRoleName = `${locationType === 'district' ? 'CITY' : 'OFFICE'}: ${parentLocation}`;
                parentRole = interaction.guild?.roles.cache.find(r => r.name === parentRoleName);
            }

            // Create role category if it doesn't exist
            const categoryName = `${locationType.toUpperCase()}S`;
            let category = interaction.guild?.roles.cache.find(r => r.name === categoryName);
            
            if (!category) {
                category = await interaction.guild?.roles.create({
                    name: categoryName,
                    color: 'DEFAULT',
                    position: 0, // Place at the top
                    hoist: true, // Show in separate section
                    mentionable: false,
                    reason: 'Location category for carpool system',
                });
            }

            // Set role permissions based on type
            const permissions = new PermissionsBitField();
            switch (locationType) {
                case 'city':
                    permissions.add([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.CreatePublicThreads,
                        PermissionsBitField.Flags.ManageThreads,
                    ]);
                    break;
                case 'district':
                    permissions.add([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                        PermissionsBitField.Flags.CreatePublicThreads,
                    ]);
                    break;
                case 'office':
                    permissions.add([
                        PermissionsBitField.Flags.ViewChannel,
                        PermissionsBitField.Flags.SendMessages,
                    ]);
                    break;
            }

            // Create the role
            role = await interaction.guild?.roles.create({
                name: roleName,
                color: locationType === 'city' ? 'BLUE' : 
                       locationType === 'district' ? 'GREEN' : 
                       'PURPLE',
                position: parentRole ? parentRole.position - 1 : category.position + 1,
                hoist: true,
                mentionable: true,
                permissions: permissions,
                reason: 'Location role for carpool system',
            });

            // Set role description
            const description = locationType === 'city' ? 
                `Members from ${locationName}` :
                locationType === 'district' ? 
                `Members from ${locationName} district of ${parentLocation}` :
                `Members working at ${locationName}${parentLocation ? ` (${parentLocation})` : ''}`;

            await role.setDescription(description);
        }

        // Assign the role to the user
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (member && role) {
            await member.roles.add(role);
        }

        await interaction.reply({
            content: `Successfully set your ${locationType} location to ${locationName}!`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error setting location:', error);
        await interaction.reply({
            content: 'There was an error setting your location. Please try again later.',
            ephemeral: true,
        });
    }
}

export async function handleRemoveLocation(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const locationType = interaction.options.getString('type', true) as 'city' | 'district' | 'office';
        const locationName = interaction.options.getString('name', true);

        const locationRole = await LocationRole.findOne({
            where: { name: locationName, type: locationType }
        });

        if (!locationRole) {
            await interaction.reply({
                content: `Location "${locationName}" not found.`,
                ephemeral: true,
            });
            return;
        }

        // Remove the user's association with the location
        await UserLocationRole.destroy({
            where: {
                userId: interaction.user.id,
                locationRoleId: locationRole.id,
            },
        });

        // Remove the Discord role
        const roleName = `${locationType.toUpperCase()}: ${locationName}`;
        const role = interaction.guild?.roles.cache.find(r => r.name === roleName);
        
        if (role) {
            const member = await interaction.guild?.members.fetch(interaction.user.id);
            if (member) {
                await member.roles.remove(role);
            }
        }

        await interaction.reply({
            content: `Successfully removed your ${locationType} location ${locationName}!`,
            ephemeral: true,
        });
    } catch (error) {
        console.error('Error removing location:', error);
        await interaction.reply({
            content: 'There was an error removing your location. Please try again later.',
            ephemeral: true,
        });
    }
} 