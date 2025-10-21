const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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

// Store active tickets with additional info
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
      
      const embed = new EmbedBuilder()
        .setColor('#00ff00')
        .setDescription(`✅ Welcome/leave channel set to ${channel}`)
        .setTimestamp();
      
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  } else if (interaction.isButton()) {
    if (interaction.customId === 'create-ticket') {
      await showTicketModal(interaction);
    } else if (interaction.customId === 'claim-ticket') {
      await claimTicket(interaction);
    } else if (interaction.customId === 'close-ticket') {
      await closeTicketButton(interaction);
    }
  } else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'ticket-modal') {
      await createTicket(interaction);
    }
  }
});

// Setup ticket panel
async function setupTicketPanel(interaction) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('🎫 Support Ticket System')
    .setDescription('Need help? Click the button below to create a support ticket.\n\nOur team will assist you as soon as possible!')
    .addFields(
      { name: '📋 What to expect', value: 'After creating a ticket, a private channel will be created where you can discuss your issue with our staff.', inline: false },
      { name: '⏱️ Response Time', value: 'We typically respond within a few minutes to a few hours.', inline: false }
    )
    .setFooter({ text: 'Click the button below to get started' })
    .setTimestamp();

  const button = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('create-ticket')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

  const setupEmbed = new EmbedBuilder()
    .setColor('#00ff00')
    .setDescription('✅ Ticket panel setup successfully!')
    .setTimestamp();

  await interaction.reply({ 
    embeds: [setupEmbed], 
    ephemeral: true 
  });

  await interaction.channel.send({ 
    embeds: [embed], 
    components: [button] 
  });
}

// Show ticket modal
async function showTicketModal(interaction) {
  // Check if user already has an open ticket
  const existingTicket = activeTickets.get(interaction.user.id);
  if (existingTicket) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ You already have an open ticket! Please close it before creating a new one.')
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('ticket-modal')
    .setTitle('Create Support Ticket');

  // Category select
  const categoryInput = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('Category')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g., General, Technical, Billing, Report')
    .setRequired(true)
    .setMaxLength(50);

  // Description input
  const descriptionInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Describe your problem')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Please provide as much detail as possible...')
    .setRequired(true)
    .setMinLength(10)
    .setMaxLength(1000);

  const firstRow = new ActionRowBuilder().addComponents(categoryInput);
  const secondRow = new ActionRowBuilder().addComponents(descriptionInput);

  modal.addComponents(firstRow, secondRow);

  await interaction.showModal(modal);
}

// Create ticket
async function createTicket(interaction) {
  const category = interaction.fields.getTextInputValue('category');
  const description = interaction.fields.getTextInputValue('description');

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

    // Store ticket with additional info
    activeTickets.set(interaction.user.id, {
      channelId: ticketChannel.id,
      category: category,
      description: description,
      claimedBy: null
    });

    // Create ticket embed
    const ticketEmbed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎫 Support Ticket')
      .setDescription(`Hello ${interaction.user}! Thank you for creating a ticket.\n\nPlease wait while a staff member claims your ticket.`)
      .addFields(
        { name: '📌 Category', value: `\`${category}\``, inline: true },
        { name: '👤 Created By', value: `${interaction.user.tag}`, inline: true },
        { name: '📝 Description', value: description, inline: false },
        { name: '🔧 Status', value: '`⏳ Waiting for staff`', inline: true },
        { name: '👨‍💼 Claimed By', value: '`None`', inline: true }
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: 'A staff member will be with you shortly' })
      .setTimestamp();

    const buttons = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('claim-ticket')
          .setLabel('Claim Ticket')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✋'),
        new ButtonBuilder()
          .setCustomId('close-ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔒')
      );

    await ticketChannel.send({ 
      content: `${interaction.user} | @here`, 
      embeds: [ticketEmbed],
      components: [buttons]
    });

    const successEmbed = new EmbedBuilder()
      .setColor('#00ff00')
      .setDescription(`✅ Ticket created successfully! Check ${ticketChannel}`)
      .setTimestamp();

    await interaction.editReply({ 
      embeds: [successEmbed]
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    
    const errorEmbed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ Failed to create ticket. Please contact an administrator.')
      .setTimestamp();
    
    await interaction.editReply({ 
      embeds: [errorEmbed]
    });
  }
}

// Claim ticket
async function claimTicket(interaction) {
  // Check if user has admin permissions
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ Only administrators can claim tickets!')
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  // Find ticket info
  const ticketEntry = Array.from(activeTickets.entries()).find(([, data]) => data.channelId === interaction.channel.id);
  
  if (!ticketEntry) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ This ticket is not tracked in the system.')
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  const [userId, ticketData] = ticketEntry;

  // Check if already claimed
  if (ticketData.claimedBy) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription(`❌ This ticket has already been claimed by <@${ticketData.claimedBy}>!`)
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  // Update ticket data
  ticketData.claimedBy = interaction.user.id;
  activeTickets.set(userId, ticketData);

  // Update embed
  const member = await interaction.guild.members.fetch(userId);
  
  const updatedEmbed = new EmbedBuilder()
    .setColor('#00ff00')
    .setTitle('🎫 Support Ticket')
    .setDescription(`Hello ${member}! Your ticket has been claimed.\n\n${interaction.user} will assist you now.`)
    .addFields(
      { name: '📌 Category', value: `\`${ticketData.category}\``, inline: true },
      { name: '👤 Created By', value: `${member.user.tag}`, inline: true },
      { name: '📝 Description', value: ticketData.description, inline: false },
      { name: '🔧 Status', value: '`✅ Claimed`', inline: true },
      { name: '👨‍💼 Claimed By', value: `${interaction.user}`, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Claimed by ${interaction.user.tag}` })
    .setTimestamp();

  const closeButton = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('close-ticket')
        .setLabel('Close Ticket')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

  await interaction.update({ 
    embeds: [updatedEmbed],
    components: [closeButton]
  });

  const claimEmbed = new EmbedBuilder()
    .setColor('#00ff00')
    .setDescription(`✋ ${interaction.user} has claimed this ticket!`)
    .setTimestamp();

  await interaction.channel.send({ embeds: [claimEmbed] });
}

// Close ticket via command
async function closeTicket(interaction) {
  const ticketEntry = Array.from(activeTickets.entries()).find(([, data]) => data.channelId === interaction.channel.id);
  
  if (!ticketEntry) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ This command can only be used in ticket channels!')
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  const [userId] = ticketEntry;

  const closeEmbed = new EmbedBuilder()
    .setColor('#ff0000')
    .setDescription('🔒 Closing ticket in 5 seconds...')
    .setFooter({ text: `Closed by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [closeEmbed] });
  
  activeTickets.delete(userId);
  
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
  const ticketEntry = Array.from(activeTickets.entries()).find(([, data]) => data.channelId === interaction.channel.id);
  
  if (!ticketEntry) {
    const embed = new EmbedBuilder()
      .setColor('#ff0000')
      .setDescription('❌ This ticket is not tracked in the system.')
      .setTimestamp();
    
    return interaction.reply({ 
      embeds: [embed], 
      ephemeral: true 
    });
  }

  const [userId] = ticketEntry;

  const closeEmbed = new EmbedBuilder()
    .setColor('#ff0000')
    .setDescription('🔒 Closing ticket in 5 seconds...')
    .setFooter({ text: `Closed by ${interaction.user.tag}` })
    .setTimestamp();

  await interaction.reply({ embeds: [closeEmbed] });
  
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
