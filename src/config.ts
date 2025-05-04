import dotenv from 'dotenv';

dotenv.config();

export const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
export const CLIENT_ID = process.env.CLIENT_ID;
export const CLIENT_SECRET = process.env.CLIENT_SECRET;
export const SESSION_SECRET = process.env.SESSION_SECRET || 'your-session-secret'; 