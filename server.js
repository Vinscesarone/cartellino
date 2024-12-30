const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const moment = require('moment');
const express = require('express');
const fs = require('fs');

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
let utentiTempo = {};

// Carica i dati salvati (persistenza)
if (fs.existsSync('utentiTempo.json')) {
    utentiTempo = JSON.parse(fs.readFileSync('utentiTempo.json', 'utf8'));
}

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
    const now = moment();

    if (interaction.customId === 'entra_servizio') {
        if (utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Sei già in servizio!', ephemeral: true });
        } else {
            utentiInServizio.set(userId, now);
            if (!utentiTempo[userId]) {
                utentiTempo[userId] = { nickname, totalTime: 0 }; // Inizializza il tempo totale
            }
            await interaction.reply({ content: 'Sei ora in servizio!', ephemeral: true });
        }
    } else if (interaction.customId === 'esci_servizio') {
        if (!utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Non hai aperto un turno di servizio.', ephemeral: true });
        } else {
            const startTime = utentiInServizio.get(userId);
            const elapsedTime = now.diff(startTime, 'seconds'); // Tempo in secondi
            utentiInServizio.delete(userId);

            // Aggiungi il tempo trascorso al totale
            utentiTempo[userId].totalTime += elapsedTime;

            // Salva i dati su file
            fs.writeFileSync('utentiTempo.json', JSON.stringify(utentiTempo, null, 2));

            await interaction.reply({ content: `Sei ora fuori servizio! Tempo totale accumulato: ${Math.floor(utentiTempo[userId].totalTime / 60)} minuti.`, ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${nickname}`) // Nome o nickname dell'utente
                    .setDescription(`è uscito dal servizio

**Tempo totale accumulato:** ${Math.floor(utentiTempo[userId].totalTime / 60)} minuti`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] });
            }
        }
    }
});

client.login(token);
