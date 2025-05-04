# Car-Poolio Discord Bot

A Discord bot for organizing carpools to work locations. This bot helps users find and organize carpools based on their work locations, schedules, and home addresses.

## Features

- User registration with home address
- Work location management with hierarchical roles (city, district, office)
- Work schedule management
- Carpool group creation and joining
- Statistics tracking
- Address to coordinates conversion
- Interactive carpool finding
- Role-based notifications
- Absence notifications
- Group messaging

## Technical Stack

- TypeScript
- Discord.js v14
- Sequelize ORM
- SQLite (development)
- Luxon for date handling
- Node.js built-in test framework

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   DISCORD_TOKEN=your_discord_bot_token_here
   ```
4. Create a Discord bot and get your token from the [Discord Developer Portal](https://discord.com/developers/applications)
5. Run the bot:
   ```bash
   pnpm start
   ```

## Commands

All commands are implemented as Discord slash commands under the `/pool` command:

- `/pool set-home <address>` - Set your home address
- `/pool set-work <name> <address>` - Set your work location
- `/pool set-schedule <location> <starttime> <endtime> <days>` - Set your work schedule
- `/pool find` - Find available carpools matching your schedule
- `/pool stats` - View carpool statistics
- `/pool notify <enabled>` - Enable/disable notifications
- `/pool out <date> <reason>` - Notify about an absence
- `/pool message <text>` - Send a message to your carpool group
- `/pool set-organizer <group>` - Set yourself as a carpool group organizer

Admin commands under `/pool-admin`:
- `/pool-admin create <name> <location> <max-size>` - Create a new carpool group
- `/pool-admin list` - List all carpool groups
- `/pool-admin announce <message>` - Send an announcement to all carpool members

## Role System

The bot implements a hierarchical role system:
- Cities (Blue roles)
- Districts (Green roles)
- Offices (Purple roles)

Roles are automatically created and managed based on work locations.

## Database

The bot uses SQLite for development. The database stores:
- User information
- Work locations
- Work schedules
- Carpool groups
- Carpool memberships
- Location roles
- User location roles

## Development

- Run in development mode with hot reload:
  ```bash
  pnpm dev
  ```
- Run tests:
  ```bash
  pnpm test
  ```
- Build for production:
  ```bash
  pnpm build
  ```

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