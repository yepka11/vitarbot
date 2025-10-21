# VitarBot - Discord Ticket Bot

A feature-rich Discord bot that provides a ticket system with multi-select categories and welcome/leave greeting features.

## Features

### 🎫 Ticket System
- **Multi-Select Categories**: Users can select one or more ticket categories when creating a ticket
- **Configurable Categories**: Easy-to-customize ticket categories with emojis and descriptions
- **Private Ticket Channels**: Each ticket creates a private channel visible only to the user and staff
- **Close Functionality**: Tickets can be closed via command or button
- **Category Organization**: All tickets are organized under a "Tickets" category

### 👋 Welcome/Leave Greetings
- **Welcome Messages**: Automatically greet new members with a customizable message
- **Leave Messages**: Send goodbye messages when members leave
- **Rich Embeds**: Beautiful embed messages with user avatars and member count
- **Configurable Channel**: Set a specific channel for greetings

## Installation

### Prerequisites
- Node.js (version 16.9.0 or higher)
- A Discord Bot Token
- Discord Application Client ID

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yepka11/vitarbot.git
   cd vitarbot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure the bot**
   - Copy `config.example.json` to `config.json`
   ```bash
   cp config.example.json config.json
   ```
   - Edit `config.json` with your details:
     - `token`: Your Discord bot token
     - `clientId`: Your Discord application client ID
     - `guildId`: Your Discord server (guild) ID
     - `welcomeChannelId`: Channel ID for welcome/leave messages
     - Customize ticket categories as needed

4. **Create a Discord Application**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token to your `config.json`
   - Enable the following Privileged Gateway Intents:
     - Server Members Intent
     - Message Content Intent

5. **Invite the bot to your server**
   - Go to OAuth2 > URL Generator
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions:
     - Manage Channels
     - Send Messages
     - Embed Links
     - Read Message History
     - View Channels
   - Copy the generated URL and open it in your browser
   - Select your server and authorize the bot

6. **Start the bot**
   ```bash
   npm start
   ```

## Usage

### Setting Up the Ticket System

1. Run the `/setup-tickets` command in any channel where you want the ticket panel to appear
2. The bot will send an embed with a dropdown menu for users to select ticket categories
3. Users can select one or multiple categories and click submit to create a ticket

### Setting Up Welcome/Leave Greetings

1. Run the `/set-welcome-channel` command and select the channel for greetings
2. The bot will automatically send welcome messages when users join
3. The bot will automatically send leave messages when users leave

### Closing Tickets

Users or staff can close tickets in two ways:
- Click the "Close Ticket" button in the ticket channel
- Use the `/close` command in the ticket channel

## Configuration

The `config.json` file allows you to customize:

- **Ticket Categories**: Add, remove, or modify ticket categories
  ```json
  {
    "label": "Technical Support",
    "value": "tech-support",
    "emoji": "🔧",
    "description": "Get help with technical issues"
  }
  ```

- **Welcome Message**: Customize the welcome message (supports `{user}` and `{server}` placeholders)
- **Leave Message**: Customize the leave message (supports `{user}` and `{server}` placeholders)

## Commands

- `/setup-tickets` - Setup the ticket system in the current channel (Admin only)
- `/set-welcome-channel` - Set the channel for welcome/leave messages (Admin only)
- `/close` - Close the current ticket (User or Staff)

## Permissions

The bot requires the following permissions:
- Manage Channels (to create ticket channels)
- Send Messages
- Embed Links
- Read Message History
- View Channels

## Support

For issues or questions, please open an issue on GitHub.

## License

MIT