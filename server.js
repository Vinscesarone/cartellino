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

client.once('ready', () => {
    console.log(`Bot ${client.user.tag} è online!`);
});

function salvaDatiSuJSON() {
    const datiUtenti = Array.from(utentiInServizio.entries()).map(([userId, orario]) => ({
        userId,
        orario
    }));

    fs.writeFile('utentiInServizio.json', JSON.stringify(datiUtenti, null, 2), (err) => {
        if (err) {
            console.error('Errore salvando i dati nel file JSON:', err);
        } else {
            console.log('Dati salvati correttamente nel file JSON.');
        }
    });
}

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
    console.log(`Interazione ricevuta: ${interaction.customId}`); // Debug per verificare l'interazione

    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const nickname = member ? member.displayName : interaction.user.username;
    const userId = interaction.user.id;
    const timestamp = moment().format('HH:mm:ss');

    if (interaction.customId === 'entra_servizio') {
        console.log('Pulsante Entra in Servizio cliccato.'); // Debug

        if (utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Sei già in servizio!', ephemeral: true });
        } else {
            console.log(`Aggiungendo ${nickname} (${userId}) alla lista utenti in servizio.`); // Debug
            utentiInServizio.set(userId, timestamp);

            salvaDatiSuJSON();

            await interaction.reply({ content: 'Sei ora in servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#008000')
                    .setTitle(`${nickname}`)
                    .setDescription(`è entrato in servizio\n\n**Data:** ${timestamp}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] }).catch(err => console.error(`Errore inviando il messaggio: ${err}`));
            } else {
                console.error('Canale utenti-in-servizio non trovato.'); // Debug
            }
        }
    } else if (interaction.customId === 'esci_servizio') {
        console.log('Pulsante Esci dal Servizio cliccato.'); // Debug

        if (!utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Non hai aperto un turno di servizio.', ephemeral: true });
        } else {
            const tempoInizio = utentiInServizio.get(userId);
            utentiInServizio.delete(userId);

            salvaDatiSuJSON();

            await interaction.reply({ content: 'Sei ora fuori servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const durataServizio = moment.duration(moment().diff(moment(tempoInizio))).humanize();

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${nickname}`)
                    .setDescription(`è uscito dal servizio\n\n**Data:** ${timestamp}\n**Durata servizio:** ${durataServizio}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] }).catch(err => console.error(`Errore inviando il messaggio: ${err}`));
            } else {
                console.error('Canale utenti-in-servizio non trovato.'); // Debug
            }
        }
    }
});

client.login(token);
