import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsBitField,
    MessageFlags,
    type InteractionResponse,
    SlashCommandBuilder,
    SlashCommandSubcommandBuilder,
    SlashCommandStringOption,
    SlashCommandBooleanOption,
    SlashCommandIntegerOption
} from 'discord.js';
import { User, WorkLocation, WorkSchedule, CarpoolGroup, CarpoolMember, LocationRole, UserLocationRole } from './database.js';
import type { 
    UserInstance,
    WorkLocationInstance,
    WorkScheduleInstance,
    CarpoolGroupInstance,
    CarpoolMemberInstance,
    WorkScheduleWithLocation,
    CarpoolGroupWithMembers,
} from './types.js';
import NodeGeocoder from 'node-geocoder';

const geocoder = NodeGeocoder({
    provider: 'openstreetmap',
});

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
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('join')
                .setDescription('Join a carpool group')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('group')
                        .setDescription('Name of the carpool group to join')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('admin')
                .setDescription('Admin commands for carpool management')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('action')
                        .setDescription('Admin action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Create Carpool', value: 'create' },
                            { name: 'List Carpools', value: 'list' },
                            { name: 'Send Announcement', value: 'announce' }
                        ))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('name')
                        .setDescription('Name of the carpool group (for create)')
                        .setRequired(false))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('location')
                        .setDescription('Name of the work location (for create)')
                        .setRequired(false))
                .addIntegerOption((option: SlashCommandIntegerOption) =>
                    option.setName('max-size')
                        .setDescription('Maximum number of members (for create)')
                        .setRequired(false))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('message')
                        .setDescription('The announcement message (for announce)')
                        .setRequired(false)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('add-office')
                .setDescription('Add a new office location')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('name')
                        .setDescription('Name of the office')
                        .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('address')
                        .setDescription('Address of the office')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('set-office')
                .setDescription('Set your work location to an existing office')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('name')
                        .setDescription('Name of the office')
                        .setRequired(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
            subcommand
                .setName('find-offices')
                .setDescription('Find offices and their carpool usage')
                .addStringOption((option: SlashCommandStringOption) =>
                    option.setName('zipcode')
                        .setDescription('Optional: Your zip code to see distances')
                        .setRequired(false)))
];

// Update the CommandHandler type to properly handle interaction responses
type CommandHandler = (interaction: ChatInputCommandInteraction) => Promise<InteractionResponse<boolean> | void>;

// Update the handleCreateCarpool function
const handleCreateCarpool = async (interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> => {
    const name = interaction.options.getString('name', true);
    const locationName = interaction.options.getString('location', true);
    const maxSize = interaction.options.getInteger('max-size', true);

    try {
        const workLocation = await WorkLocation.findOne({ where: { name: locationName } }) as WorkLocationInstance | null;
        if (!workLocation) {
            return interaction.reply({ 
                content: 'Work location not found. Please create the work location first.',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        await CarpoolGroup.create({
            name,
            workLocationId: workLocation.id,
            maxSize
        });

        return interaction.reply({ 
            content: `Successfully created carpool group: ${name}`,
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Create carpool error:', error);
        return interaction.reply({ 
            content: 'There was an error creating the carpool group. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
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
            flags: [MessageFlags.Ephemeral] 
        });
    }
};

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
                // Just log the notification for now
                console.log(`Notification for ${member.User.discordId}: ${message}`);
            }
        }
    } catch (error) {
        console.error('Error notifying carpool members:', error);
    }
}

// Update the handleSetHome function
export async function handleSetHome(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    try {
        const address = interaction.options.getString('address', true);
        const result = await geocoder.geocode(address);
        
        if (result.length === 0) {
            return interaction.reply({
                content: 'Could not find the address. Please try again with a more specific location.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const { latitude, longitude } = result[0];
        if (!latitude || !longitude) {
            return interaction.reply({
                content: 'Could not get coordinates for the address. Please try again.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        let user = await User.findByPk(interaction.user.id) as UserInstance | null;
        
        if (!user) {
            // Create new user if they don't exist
            user = await User.create({
                id: interaction.user.id,
                discordId: interaction.user.id,
                homeAddress: address,
                homeLatitude: latitude,
                homeLongitude: longitude,
                notificationsEnabled: true
            }) as UserInstance;
        } else {
            // Update existing user
            await user.update({
                homeLatitude: latitude,
                homeLongitude: longitude,
                homeAddress: address,
            });
        }

        return interaction.reply({
            content: `Successfully set your home location to ${address}!`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error setting home location:', error);
        return interaction.reply({
            content: 'There was an error setting your home location. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}


export async function handleSetSchedule(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const locationName = interaction.options.getString('location', true);
        const startTime = interaction.options.getString('starttime', true);
        const endTime = interaction.options.getString('endtime', true);
        const daysOfWeek = interaction.options.getString('days', true);

        const workLocation = await WorkLocation.findOne({ where: { name: locationName } }) as WorkLocationInstance | null;
        if (!workLocation) {
            await interaction.reply({
                content: `Work location "${locationName}" not found. Please create it first.`,
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const schedule = await WorkSchedule.create({
            userId: interaction.user.id,
            workLocationId: workLocation.id,
            startTime,
            endTime,
            daysOfWeek,
        }) as WorkScheduleInstance;

        await interaction.reply({
            content: `Successfully set your schedule for ${locationName}!`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error setting schedule:', error);
        await interaction.reply({
            content: 'There was an error setting your schedule. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

export async function handleFindCarpool(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const user = await User.findByPk(interaction.user.id) as UserInstance | null;
        if (!user) {
            await interaction.reply({
                content: 'Please register first using /pool set-home',
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const workSchedules = await WorkSchedule.findAll({
            where: { userId: interaction.user.id },
            include: [{ model: WorkLocation }],
        }) as WorkScheduleWithLocation[];

        if (workSchedules.length === 0) {
            await interaction.reply({
                content: 'Please set your work schedule first using /pool set-schedule',
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const carpoolGroups = await CarpoolGroup.findAll({
            where: { workLocationId: workSchedules[0].workLocationId },
            include: [
                { model: WorkLocation },
                { model: CarpoolMember, include: [{ model: User }] },
            ],
        }) as CarpoolGroupWithMembers[];

        if (carpoolGroups.length === 0) {
            await interaction.reply({
                content: 'No carpool groups found for your work location.',
                flags: [MessageFlags.Ephemeral]
            });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('Available Carpool Groups')
            .setDescription('Here are the carpool groups available for your work location:')
            .setColor('#0099ff');

        for (const group of carpoolGroups) {
            const members = group.CarpoolMembers.map(member => member.User.discordId);
            embed.addFields({
                name: group.name,
                value: `Location: ${group.WorkLocation.name}\nMembers: ${members.length}/${group.maxSize}\nMembers: ${members.join(', ')}`,
            });
        }

        await interaction.reply({
            embeds: [embed],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error finding carpools:', error);
        await interaction.reply({
            content: 'There was an error finding carpools. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

export async function handleStats(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
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

        return interaction.reply({ embeds: [embed] });
    } catch (error) {
        console.error('Stats error:', error);
        return interaction.reply({ 
            content: 'There was an error retrieving statistics. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

export async function handleNotify(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    const enabled = interaction.options.getBoolean('enabled', true);
    
    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        user.notificationsEnabled = enabled;
        await user.save();

        return interaction.reply({ 
            content: `Notifications ${enabled ? 'enabled' : 'disabled'} successfully!`,
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Notification settings error:', error);
        return interaction.reply({ 
            content: 'There was an error updating your notification settings. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

export async function handleOut(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    const date = interaction.options.getString('date', true);
    const reason = interaction.options.getString('reason', true);

    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                flags: [MessageFlags.Ephemeral] 
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
                flags: [MessageFlags.Ephemeral] 
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
                membership.carpoolGroupId.toString(),
                `🚫 ${interaction.user.username} will be out on ${date} (${reason})`,
                embed
            );
        }

        return interaction.reply({ 
            content: 'Your absence has been notified to all your carpool groups.',
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Out notification error:', error);
        return interaction.reply({ 
            content: 'There was an error sending your absence notification. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

export async function handleMessage(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    const message = interaction.options.getString('text', true);

    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please set your home address first using /pool set-home',
                flags: [MessageFlags.Ephemeral] 
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
                flags: [MessageFlags.Ephemeral] 
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
                membership.carpoolGroupId.toString(),
                `💬 ${interaction.user.username}: ${message}`,
                embed
            );
        }

        return interaction.reply({ 
            content: 'Your message has been sent to all your carpool groups.',
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Message error:', error);
        return interaction.reply({ 
            content: 'There was an error sending your message. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

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
                await notifyCarpoolMembers(user.discordId, '', embed);
            }
        }

        interaction.reply({ 
            content: 'Announcement sent successfully!',
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Announcement error:', error);
        interaction.reply({ 
            content: 'There was an error sending the announcement. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
};

// Update the handleSetOrganizer function
export const handleSetOrganizer = async (interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> => {
    const groupName = interaction.options.getString('group', true);
    
    try {
        // Check if user exists
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please register first using /pool set-home',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Find the carpool group
        const carpoolGroup = await CarpoolGroup.findOne({ 
            where: { name: groupName },
            include: [
                { model: WorkLocation },
                { model: CarpoolMember, include: [{ model: User }] }
            ]
        }) as CarpoolGroupWithMembers | null;

        if (!carpoolGroup) {
            return interaction.reply({ 
                content: 'Carpool group not found. Please check the group name and try again.',
                flags: [MessageFlags.Ephemeral] 
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
                flags: [MessageFlags.Ephemeral] 
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

        await notifyCarpoolMembers(carpoolGroup.id.toString(), `👑 ${interaction.user.username} is now an organizer for ${groupName}`, embed);

        return interaction.reply({ 
            content: `You are now an organizer for ${groupName}!`,
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Set organizer error:', error);
        return interaction.reply({ 
            content: 'There was an error setting you as an organizer. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
};

// Add the handler function for joining a carpool
export async function handleJoinCarpool(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    const groupName = interaction.options.getString('group', true);
    
    try {
        // Check if user exists
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({ 
                content: 'Please register first using /pool set-home',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Find the carpool group
        const carpoolGroup = await CarpoolGroup.findOne({ 
            where: { name: groupName },
            include: [
                { model: WorkLocation },
                { model: CarpoolMember, include: [{ model: User }] }
            ]
        }) as CarpoolGroupWithMembers | null;

        if (!carpoolGroup) {
            return interaction.reply({ 
                content: 'Carpool group not found. Please check the group name and try again.',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Check if group is full
        if (carpoolGroup.CarpoolMembers.length >= carpoolGroup.maxSize) {
            return interaction.reply({ 
                content: 'This carpool group is full.',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Check if user is already a member
        const existingMember = await CarpoolMember.findOne({
            where: {
                userId: interaction.user.id,
                carpoolGroupId: carpoolGroup.id
            }
        });

        if (existingMember) {
            return interaction.reply({ 
                content: 'You are already a member of this carpool group.',
                flags: [MessageFlags.Ephemeral] 
            });
        }

        // Add user to carpool group
        await CarpoolMember.create({
            userId: interaction.user.id,
            carpoolGroupId: carpoolGroup.id,
            isOrganizer: false
        });

        // Notify carpool members
        const embed = new EmbedBuilder()
            .setTitle('New Carpool Member')
            .setDescription(`${interaction.user.username} has joined ${groupName}`)
            .setColor('#00ff00')
            .setTimestamp();

        await notifyCarpoolMembers(carpoolGroup.id.toString(), `👋 ${interaction.user.username} has joined ${groupName}`, embed);

        return interaction.reply({ 
            content: `Successfully joined carpool group: ${groupName}`,
            flags: [MessageFlags.Ephemeral] 
        });
    } catch (error) {
        console.error('Join carpool error:', error);
        return interaction.reply({ 
            content: 'There was an error joining the carpool group. Please try again later.',
            flags: [MessageFlags.Ephemeral] 
        });
    }
}

export async function handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
    console.log('=== Interaction Received ===');
    console.log('Command Name:', interaction.commandName);
    console.log('User ID:', interaction.user.id);
    console.log('Guild ID:', interaction.guildId);
    console.log('Subcommand:', interaction.options.getSubcommand());
    
    try {
        // Check for pool-admin role if using admin commands
        if (interaction.options.getSubcommand() === 'admin') {
            console.log('Checking pool-admin role...');
            const member = await interaction.guild?.members.fetch(interaction.user.id);
            console.log('Member found:', !!member);
            const hasAdminRole = member?.roles.cache.some(role => role.name === 'pool-admin');
            console.log('Has admin role:', hasAdminRole);
            
            if (!hasAdminRole) {
                console.log('No admin role, sending error message');
                await interaction.reply({
                    content: 'You need the pool-admin role to use this command.',
                    flags: [MessageFlags.Ephemeral]
                });
                return;
            }
        }

        const commandHandlers: Record<string, Record<string, CommandHandler>> = {
            pool: {
                'set-home': handleSetHome,
                'set-schedule': handleSetSchedule,
                'find': handleFindCarpool,
                'stats': handleStats,
                'notify': handleNotify,
                'out': handleOut,
                'message': handleMessage,
                'set-organizer': handleSetOrganizer,
                'join': handleJoinCarpool,
                'find-offices': handleFindOffices,
                'add-office': handleAddOffice,
                'set-office': handleSetOffice,
                'admin': async (interaction: ChatInputCommandInteraction) => {
                    const action = interaction.options.getString('action', true);
                    switch (action) {
                        case 'create':
                            return handleCreateCarpool(interaction);
                        case 'list':
                            return handleListCarpools(interaction);
                        case 'announce':
                            return handleAnnounce(interaction);
                        default:
                            return interaction.reply({
                                content: 'Invalid admin action.',
                                flags: [MessageFlags.Ephemeral]
                            });
                    }
                }
            }
        };

        const handler = commandHandlers[interaction.commandName]?.[interaction.options.getSubcommand()];
        console.log('Handler found:', !!handler);
        
        if (handler) {
            console.log('Executing handler...');
            await handler(interaction);
        } else {
            console.log('No handler found for command: ', interaction.commandName);
        }
    } catch (error) {
        console.error('Error in handleInteraction:', error);
        await interaction.reply({
            content: 'There was an error processing your command. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

export async function handleSetLocation(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            await interaction.reply({
                content: 'Please register first using /pool set-home',
                flags: [MessageFlags.Ephemeral]
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
                        flags: [MessageFlags.Ephemeral]
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
                    color: 'Default',
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
                color: locationType === 'city' ? 'Blue' : 
                       locationType === 'district' ? 'Green' : 
                       'Purple',
                position: parentRole ? parentRole.position - 1 : category?.position ? category.position + 1 : 0,
                hoist: true,
                mentionable: true,
                permissions: permissions,
                reason: 'Location role for carpool system',
            });

            if (!role) {
                throw new Error('Failed to create role');
            }

            // Set role description
            const description = locationType === 'city' ? 
                `Members from ${locationName}` :
                locationType === 'district' ? 
                `Members from ${locationName} district of ${parentLocation}` :
                `Members working at ${locationName}${parentLocation ? ` (${parentLocation})` : ''}`;

            await role.edit({ reason: description });
        }

        // Assign the role to the user
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        if (member && role) {
            await member.roles.add(role);
            await interaction.reply({
                content: `Successfully assigned you the ${roleName} role!`,
                flags: [MessageFlags.Ephemeral]
            });
        } else {
            throw new Error('Failed to assign role to user');
        }
    } catch (error) {
        console.error('Error setting location:', error);
        await interaction.reply({
            content: 'There was an error setting your location. Please try again later.',
            flags: [MessageFlags.Ephemeral]
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
                flags: [MessageFlags.Ephemeral]
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
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error removing location:', error);
        await interaction.reply({
            content: 'There was an error removing your location. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export async function handleAddOffice(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    try {
        const name = interaction.options.getString('name', true);
        const address = interaction.options.getString('address', true);
        const result = await geocoder.geocode(address);
        
        if (result.length === 0) {
            return interaction.reply({
                content: 'Could not find the address. Please try again with a more specific location.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const { latitude, longitude } = result[0];
        if (!latitude || !longitude) {
            return interaction.reply({
                content: 'Could not get coordinates for the address. Please try again.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Check if office with same name already exists
        const existingOffice = await WorkLocation.findOne({ where: { name } });
        if (existingOffice) {
            return interaction.reply({
                content: 'An office with this name already exists. Please choose a different name.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const workLocation = await WorkLocation.create({
            name,
            address,
            latitude,
            longitude,
        }) as WorkLocationInstance;

        return interaction.reply({
            content: `Successfully added office ${name} at ${address}!`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error adding office:', error);
        return interaction.reply({
            content: 'There was an error adding the office. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

export async function handleSetOffice(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    try {
        const name = interaction.options.getString('name', true);
        
        // Check if user exists
        const user = await User.findByPk(interaction.user.id);
        if (!user) {
            return interaction.reply({
                content: 'Please register first using /pool set-home',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Find the office
        const office = await WorkLocation.findOne({ where: { name } });
        if (!office) {
            return interaction.reply({
                content: 'Office not found. Please check the name or add it first using /pool add-office',
                flags: [MessageFlags.Ephemeral]
            });
        }

        // Create or update work schedule
        const [schedule] = await WorkSchedule.findOrCreate({
            where: { userId: interaction.user.id },
            defaults: {
                userId: interaction.user.id,
                workLocationId: office.id,
                startTime: '09:00', // Default values
                endTime: '17:00',
                daysOfWeek: '1,2,3,4,5'
            }
        });

        if (schedule.workLocationId !== office.id) {
            await schedule.update({ workLocationId: office.id });
        }

        return interaction.reply({
            content: `Successfully set your work location to ${name}!`,
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error setting office:', error);
        return interaction.reply({
            content: 'There was an error setting your office. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
}

export async function handleFindOffices(interaction: ChatInputCommandInteraction): Promise<InteractionResponse<boolean>> {
    try {
        const zipCode = interaction.options.getString('zipcode');
        const offices = await WorkLocation.findAll({
            include: [{
                model: WorkSchedule,
                include: [{
                    model: User,
                    include: [{
                        model: CarpoolMember,
                        include: [CarpoolGroup]
                    }]
                }]
            }]
        }) as (WorkLocationInstance & {
            WorkSchedules: (WorkScheduleInstance & {
                User: UserInstance & {
                    CarpoolMembers: CarpoolMemberInstance[];
                };
            })[];
        })[];

        if (offices.length === 0) {
            return interaction.reply({
                content: 'No offices found in the system yet.',
                flags: [MessageFlags.Ephemeral]
            });
        }

        const embed = new EmbedBuilder()
            .setTitle('Available Offices')
            .setDescription('Here are all the offices in our system:')
            .setColor('#0099ff');

        for (const office of offices) {
            // Count total users at this office
            const totalUsers = office.WorkSchedules?.length || 0;
            
            // Count users in carpools
            const usersInCarpools = office.WorkSchedules?.filter(schedule => 
                schedule.User?.CarpoolMembers?.length > 0
            ).length || 0;

            // Calculate carpool participation rate
            const participationRate = totalUsers > 0 
                ? ((usersInCarpools / totalUsers) * 100).toFixed(1)
                : '0';

            let officeInfo = `${office.address}`;
            if (zipCode) {
                const distance = await geocoder.geocode(zipCode)
                    .then(results => {
                        if (results.length > 0 && results[0].latitude && results[0].longitude) {
                            return calculateDistance(
                                results[0].latitude,
                                results[0].longitude,
                                office.latitude,
                                office.longitude
                            );
                        }
                        return null;
                    });
                
                if (distance !== null) {
                    officeInfo += `\nDistance from ${zipCode}: ${distance.toFixed(1)}km`;
                }
            }

            officeInfo += `\nTotal Users: ${totalUsers}`;
            officeInfo += `\nUsers in Carpools: ${usersInCarpools}`;
            officeInfo += `\nCarpool Participation: ${participationRate}%`;

            embed.addFields({
                name: office.name,
                value: officeInfo
            });
        }

        return interaction.reply({
            embeds: [embed],
            flags: [MessageFlags.Ephemeral]
        });
    } catch (error) {
        console.error('Error finding offices:', error);
        return interaction.reply({
            content: 'There was an error finding offices. Please try again later.',
            flags: [MessageFlags.Ephemeral]
        });
    }
} 