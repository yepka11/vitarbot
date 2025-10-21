const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');

// Load configuration
let config;
try {
  config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
} catch (error) {
  console.error('Error loading config.json. Please create it from config.example.json');
  process.exit(1);
}

// Create Discord client with necessary intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Store active tickets
const activeTickets = new Map();

// Bot ready event
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);
  
  // Register slash commands
  const commands = [
    {
      name: 'setup-tickets',
      description: 'Setup the ticket system in this channel'
    },
    {
      name: 'close',
      description: 'Close the current ticket'
    },
    {
      name: 'set-welcome-channel',
      description: 'Set the welcome/leave channel',
      options: [
        {
          name: 'channel',
          description: 'The channel for welcome/leave messages',
          type: 7, // CHANNEL type
          required: true
        }
      ]
    }
  ];

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    if (commandName === 'setup-tickets') {
      await setupTicketPanel(interaction);
    } else if (commandName === 'close') {
      await closeTicket(interaction);
    } else if (commandName === 'set-welcome-channel') {
      const channel = interaction.options.getChannel('channel');
      config.welcomeChannelId = channel.id;
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
      await interaction.reply({ content: `✅ Welcome/leave channel set to ${channel}`, ephemeral: true });
    }
  } else if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'ticket-category-select') {
      await createTicket(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'close-ticket') {
      await closeTicketButton(interaction);
    }
  }
});

// Setup ticket panel
async function setupTicketPanel(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🎫 Create a Ticket')
    .setDescription('Select one or more categories below to create a ticket.\nOur support team will assist you shortly!')
    .setFooter({ text: 'Select the categories that best describe your issue' })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('ticket-category-select')
    .setPlaceholder('Select ticket categories')
    .setMinValues(1)
    .setMaxValues(config.ticketCategories.length);

  // Add options from config
  config.ticketCategories.forEach(category => {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(category.label)
        .setValue(category.value)
        .setDescription(category.description)
        .setEmoji(category.emoji)
    );
  });

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({ 
    content: 'Ticket panel setup successfully!', 
    ephemeral: true 
  });

  await interaction.channel.send({ 
    embeds: [embed], 
    components: [row] 
  });
}

// Create ticket
async function createTicket(interaction) {
  const selectedCategories = interaction.values;
  const categoryLabels = selectedCategories
    .map(val => config.ticketCategories.find(cat => cat.value === val)?.label)
    .join(', ');

  // Check if user already has an open ticket
  const existingTicket = activeTickets.get(interaction.user.id);
  if (existingTicket) {
    return interaction.reply({ 
      content: '❌ You already have an open ticket! Please close it before creating a new one.', 
      ephemeral: true 
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Find or create ticket category
    let ticketCategory;
    if (config.ticketCategoryId) {
      ticketCategory = interaction.guild.channels.cache.get(config.ticketCategoryId);
    }
    
    if (!ticketCategory) {
      ticketCategory = await interaction.guild.channels.create({
        name: 'Tickets',
        type: ChannelType.GuildCategory
      });
      config.ticketCategoryId = ticketCategory.id;
      fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    }

    // Create ticket channel
    const ticketChannel = await interaction.guild.channels.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.GuildText,
      parent: ticketCategory.id,
      permissionOverwrites: [
        {
          id: interaction.guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: interaction.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });

    // Store ticket
    activeTickets.set(interaction.user.id, ticketChannel.id);

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('🎫 Ticket Created')
      .setDescription(`Thank you for creating a ticket, ${interaction.user}!`)
      .addFields(
        { name: 'Categories', value: categoryLabels, inline: true },
        { name: 'Created By', value: `${interaction.user.tag}`, inline: true }
      )
      .setFooter({ text: 'A staff member will be with you shortly' })
      .setTimestamp();

    const closeButton = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close-ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await ticketChannel.send({ 
      content: `${interaction.user}`, 
      embeds: [ticketEmbed],
      components: [closeButton]
    });

    await interaction.editReply({ 
      content: `✅ Ticket created! Check ${ticketChannel}` 
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    await interaction.editReply({ 
      content: '❌ Failed to create ticket. Please contact an administrator.' 
    });
  }
}

// Close ticket via command
async function closeTicket(interaction) {
  const ticketChannelId = activeTickets.get(interaction.user.id);
  
  if (!ticketChannelId || interaction.channel.id !== ticketChannelId) {
    return interaction.reply({ 
      content: '❌ This command can only be used in your ticket channel!', 
      ephemeral: true 
    });
  }

  await interaction.reply('🔒 Closing ticket in 5 seconds...');
  
  activeTickets.delete(interaction.user.id);
  
  setTimeout(async () => {
    try {
      await interaction.channel.delete();
    } catch (error) {
      console.error('Error deleting ticket channel:', error);
    }
  }, 5000);
}

// Close ticket via button
async function closeTicketButton(interaction) {
  const userId = Array.from(activeTickets.entries()).find(([, channelId]) => channelId === interaction.channel.id)?.[0];
  
  if (!userId) {
    return interaction.reply({ 
      content: '❌ This ticket is not tracked in the system.', 
      ephemeral: true 
    });
  }

  await interaction.reply('🔒 Closing ticket in 5 seconds...');
  
  activeTickets.delete(userId);
  
  setTimeout(async () => {
    try {
      await interaction.channel.delete();
    } catch (error) {
      console.error('Error deleting ticket channel:', error);
    }
  }, 5000);
}

// Welcome event
client.on('guildMemberAdd', async member => {
  if (!config.welcomeChannelId) return;
  
  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) return;

  const welcomeMsg = config.welcomeMessage
    .replace('{user}', `${member}`)
    .replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('👋 Welcome!')
    .setDescription(welcomeMsg)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Member #${member.guild.memberCount}` })
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
});

// Leave event
client.on('guildMemberRemove', async member => {
  if (!config.welcomeChannelId) return;
  
  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) return;

  const leaveMsg = config.leaveMessage
    .replace('{user}', member.user.tag)
    .replace('{server}', member.guild.name);

  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('👋 Goodbye!')
    .setDescription(leaveMsg)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();

  try {
    await channel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Error sending leave message:', error);
  }
});

// Login to Discord
client.login(config.token);
