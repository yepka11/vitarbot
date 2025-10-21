# VitarBot - Technical Documentation

## Architecture Overview

VitarBot is built using Discord.js v14 and provides two main features:
1. Multi-select ticket system
2. Welcome/leave greeting system

## Components

### 1. Ticket System

#### Ticket Creation Flow
1. Admin runs `/setup-tickets` command in a channel
2. Bot creates an embed with a multi-select dropdown menu
3. User selects one or more ticket categories from the dropdown
4. Bot creates a private channel under "Tickets" category
5. Only the user and staff can view the ticket channel
6. Bot sends an embed with ticket details and a close button

#### Ticket Closure Flow
- Users can close tickets using the `/close` command
- Users can click the "Close Ticket" button
- Ticket channels are deleted after a 5-second countdown

#### Multi-Select Implementation
The bot uses `StringSelectMenuBuilder` with:
- `setMinValues(1)`: Users must select at least 1 category
- `setMaxValues(config.ticketCategories.length)`: Users can select up to all available categories

### 2. Welcome/Leave Greeting System

#### Welcome Flow
1. Bot listens for `guildMemberAdd` event
2. Fetches the configured welcome channel
3. Creates a rich embed with:
   - Welcome message with placeholders replaced
   - User's avatar
   - Member count
   - Timestamp
4. Sends the embed to the welcome channel

#### Leave Flow
1. Bot listens for `guildMemberRemove` event
2. Fetches the configured welcome channel
3. Creates a rich embed with:
   - Leave message with placeholders replaced
   - User's avatar
   - Timestamp
4. Sends the embed to the welcome channel

## Configuration

### config.json Structure
```json
{
  "token": "Bot token from Discord Developer Portal",
  "clientId": "Application ID from Discord Developer Portal",
  "guildId": "Server ID where commands should be registered",
  "ticketCategories": [
    {
      "label": "Display name",
      "value": "internal-id",
      "emoji": "emoji-icon",
      "description": "Help text"
    }
  ],
  "ticketCategoryId": "Auto-populated category ID",
  "welcomeChannelId": "Channel ID for greetings",
  "welcomeMessage": "Message with {user} and {server} placeholders",
  "leaveMessage": "Message with {user} and {server} placeholders"
}
```

## Required Intents

The bot requires these Gateway Intents:
- `Guilds`: Basic guild information
- `GuildMembers`: Member join/leave events (Privileged)
- `GuildMessages`: Message handling
- `MessageContent`: Reading message content (Privileged)

## Required Permissions

Bot Permissions (Bit field: 268437520):
- `ViewChannel` (1024)
- `SendMessages` (2048)
- `EmbedLinks` (16384)
- `ReadMessageHistory` (65536)
- `ManageChannels` (16): For creating ticket channels

## Slash Commands

### `/setup-tickets`
- **Description**: Creates the ticket panel in the current channel
- **Required Permissions**: Administrator
- **Behavior**: Sends an embed with a multi-select dropdown

### `/close`
- **Description**: Closes the current ticket
- **Required Permissions**: None (user must be in their ticket)
- **Behavior**: Deletes the ticket channel after 5 seconds

### `/set-welcome-channel`
- **Description**: Sets the channel for welcome/leave messages
- **Required Permissions**: Administrator
- **Parameters**: 
  - `channel`: The text channel to use
- **Behavior**: Updates config.json with the new channel ID

## Data Storage

### In-Memory Storage
- `activeTickets` Map: Stores user ID → ticket channel ID mapping
- Cleared when bot restarts
- Used to prevent duplicate tickets and enable ticket closure

### File Storage
- `config.json`: Persistent configuration
- Updated when:
  - Welcome channel is set
  - Ticket category is created for the first time

## Error Handling

The bot includes error handling for:
- Missing config.json file
- Failed channel creation
- Failed message sending
- Invalid ticket closure attempts
- Missing welcome channel

## Scalability Considerations

### Current Limitations
- One ticket per user at a time
- In-memory ticket storage (lost on restart)
- Commands registered per guild (not global)

### Future Improvements
- Database for persistent ticket tracking
- Ticket transcripts
- Multiple tickets per user
- Global slash commands
- Staff role permissions
- Ticket claiming system
