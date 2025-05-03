import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, ChatInputCommandInteraction, ApplicationCommandOptionType } from 'discord.js';
import { setupDatabase } from './database.ts';
import { handleInteraction, commands, handleSetHome, handleFindCarpool, handleMessage, handleNotify, handleOut, handleRemoveLocation, handleSetLocation, handleSetOrganizer, handleSetSchedule, handleSetWork, handleStats } from './commands.ts';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction]
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    await setupDatabase();

    // Register slash commands
    try {
        console.log('Started refreshing application (/) commands.');
        await client.application?.commands.set(commands);
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error refreshing application commands:', error);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options } = interaction;

    if (commandName === 'pool') {
        const subcommand = options.getSubcommand();
        const handler = {
            'set-home': handleSetHome,
            'set-work': handleSetWork,
            'set-schedule': handleSetSchedule,
            'find-carpool': handleFindCarpool,
            'stats': handleStats,
            'notify': handleNotify,
            'out': handleOut,
            'message': handleMessage,
            'set-organizer': handleSetOrganizer,
            'set-location': handleSetLocation,
            'remove-location': handleRemoveLocation,
        }[subcommand];

        if (handler) {
            await handler(interaction);
        }
    }
});

client.login(process.env.DISCORD_TOKEN); 