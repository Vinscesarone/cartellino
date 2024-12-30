const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const moment = require('moment');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Server per mantenere il progetto attivo
app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}`));

// Bot Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const token = process.env.DISCORD_TOKEN;
const utentiInServizio = new Map();

client.once('ready', () => {
    console.log(`Bot ${client.user.tag} è online!`);
});

client.on('messageCreate', async (message) => {
    if (message.channel.name === 'cartellino' && !message.author.bot) {
        const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
        fetchedMessages.forEach(msg => {
            if (msg.author.bot && msg.components.length === 0) {
                msg.delete().catch(err => console.error(`Errore eliminando messaggio: ${err}`));
            }
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('entra_servizio')
                .setLabel('Entra in Servizio')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('esci_servizio')
                .setLabel('Esci dal Servizio')
                .setStyle(ButtonStyle.Danger)
        );

        const botMessages = fetchedMessages.filter(msg => msg.author.bot && msg.components.length > 0);
        if (botMessages.size === 0) {
            await message.channel.send({ content: 'Scegli un\'azione:', components: [row] });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const nickname = member ? member.displayName : interaction.user.username;
    const userId = interaction.user.id;
    const timestamp = moment().format('HH:mm:ss');

    if (interaction.customId === 'entra_servizio') {
        if (utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Sei già in servizio!', ephemeral: true });
        } else {
            utentiInServizio.set(userId, timestamp);
            await interaction.reply({ content: 'Sei ora in servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#008000')
                    .setTitle(`${nickname}`) // Nome o nickname dell'utente
                    .setDescription(`è entrato in servizio\n\n**Data:** ${timestamp}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] });
            }
        }
    } else if (interaction.customId === 'esci_servizio') {
        if (!utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Non hai aperto un turno di servizio.', ephemeral: true });
        } else {
            utentiInServizio.delete(userId);
            await interaction.reply({ content: 'Sei ora fuori servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${nickname}`) // Nome o nickname dell'utente
                    .setDescription(`è uscito dal servizio\n\n**Data:** ${timestamp}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] });
            }
        }
    }
});

client.login(token);
