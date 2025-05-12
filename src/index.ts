import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, ChatInputCommandInteraction, ApplicationCommandOptionType, REST, Routes, MessageFlags } from 'discord.js';
import { setupDatabase } from './database.ts';
import { handleInteraction, commands } from './commands.ts';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ],
    partials: [Partials.Message, Partials.Reaction]
});

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        
        if (!client.application?.id) {
            throw new Error('Client application ID not found');
        }
        
        // Register commands globally
        await rest.put(
            Routes.applicationCommands(client.application.id),
            { body: commands.map(command => command.toJSON()) }
        );
        
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

client.once('ready', async () => {
    console.log(`Logged in as ${client.user?.tag}!`);
    await setupDatabase();
    await registerCommands();
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    
    try {
        await handleInteraction(interaction);
    } catch (error) {
        console.error('Error handling interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error processing your command. Please try again later.',
                flags: [MessageFlags.Ephemeral]
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN); 