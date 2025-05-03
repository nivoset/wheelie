# Car-Poolio Discord Bot

A Discord bot for organizing carpools to work locations. This bot helps users find and organize carpools based on their work locations, schedules, and home addresses.

## Features

- User registration with home address
- Work location management
- Work schedule management
- Carpool group creation and joining
- Statistics tracking
- Address to coordinates conversion
- Interactive carpool finding

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   PREFIX=!
   ```
4. Create a Discord bot and get your token from the [Discord Developer Portal](https://discord.com/developers/applications)
5. Run the bot:
   ```bash
   pnpm start
   ```

## Commands

- `!register <address>` - Register your home address
- `!setwork <location name> <address>` - Set your work location
- `!setschedule <work location> <start time> <end time> <days>` - Set your work schedule
- `!findcarpool` - Find available carpools matching your schedule
- `!stats` - View carpool statistics

## Database

The bot uses SQLite for development and can be configured to use PostgreSQL for production. The database stores:
- User information
- Work locations
- Work schedules
- Carpool groups
- Carpool memberships

## AWS Deployment

For production deployment on AWS EC2:

1. Set up an EC2 instance
2. Install Node.js and npm
3. Configure PostgreSQL database
4. Update environment variables for production
5. Use PM2 or similar for process management
6. Set up SSL certificates if needed

## Contributing

Feel free to submit issues and enhancement requests! 