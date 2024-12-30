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
    // Ignora i messaggi dai bot
    if (message.author.bot) return;

    // Comandi del bot
    const prefix = '!'; // Definisci il prefisso per i comandi
    if (!message.content.startsWith(prefix)) return;

    // Ottieni il comando rimuovendo il prefisso
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'leggidati') {
        fs.readFile('utentiInServizio.json', 'utf8', (err, data) => {
            if (err) {
                message.channel.send('Errore leggendo il file JSON. Assicurati che esista.');
                console.error('Errore leggendo il file JSON:', err);
            } else {
                try {
                    const contenuto = JSON.parse(data);
                    message.channel.send('Contenuto del file JSON:\n' + '```json\n' + JSON.stringify(contenuto, null, 2) + '\n```');
                } catch (parseErr) {
                    message.channel.send('Errore analizzando il file JSON.');
                    console.error('Errore analizzando il file JSON:', parseErr);
                }
            }
        });
    }

    if (command === 'inservizio') {
        if (utentiInServizio.size === 0) {
            message.channel.send('Nessun utente è attualmente in servizio.');
        } else {
            const utenti = Array.from(utentiInServizio.entries()).map(([userId, orario]) => {
                const user = message.guild.members.cache.get(userId);
                const nickname = user ? user.displayName : userId;
                return `- ${nickname} (Entrato: ${moment(orario).format('HH:mm:ss')})`;
            });
            message.channel.send('Utenti attualmente in servizio:\n' + utenti.join('\n'));
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    console.log(`Interazione ricevuta: ${interaction.customId}`); // Debug per verificare l'interazione

    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    const nickname = member ? member.displayName : interaction.user.username;
    const userId = interaction.user.id;

    if (interaction.customId === 'entra_servizio') {
        console.log('Pulsante Entra in Servizio cliccato.'); // Debug

        if (utentiInServizio.has(userId)) {
            await interaction.reply({ content: 'Sei già in servizio!', ephemeral: true });
        } else {
            const timestampInizio = Date.now(); // Salviamo un timestamp numerico
            console.log(`Timestamp salvato: ${timestampInizio}`); // Debug
            utentiInServizio.set(userId, timestampInizio);

            salvaDatiSuJSON();

            await interaction.reply({ content: 'Sei ora in servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#008000')
                    .setTitle(`${nickname}`)
                    .setDescription(`è entrato in servizio\n\n**Data:** ${moment(timestampInizio).format('HH:mm:ss')}`)
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
            const timestampInizio = utentiInServizio.get(userId); // Recupera il timestamp numerico
            console.log(`Timestamp recuperato: ${timestampInizio}`); // Debug
            utentiInServizio.delete(userId);

            salvaDatiSuJSON();

            await interaction.reply({ content: 'Sei ora fuori servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const durataServizio = moment.duration(Date.now() - timestampInizio).humanize();
                console.log(`Durata calcolata: ${durataServizio}`); // Debug

                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${nickname}`)
                    .setDescription(`è uscito dal servizio\n\n**Data:** ${moment().format('HH:mm:ss')}\n**Durata servizio:** ${durataServizio}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] }).catch(err => console.error(`Errore inviando il messaggio: ${err}`));
            } else {
                console.error('Canale utenti-in-servizio non trovato.'); // Debug
            }
        }
    }
});

client.login(token);
