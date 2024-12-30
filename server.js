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

function leggiStorico() {
    try {
        const data = fs.readFileSync('storicoUtenti.json', 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Errore leggendo o analizzando lo storico:', err);
        return [];
    }
}

function scriviStorico(storico) {
    try {
        fs.writeFileSync('storicoUtenti.json', JSON.stringify(storico, null, 2), 'utf8');
        console.log('Storico aggiornato correttamente.');
    } catch (err) {
        console.error('Errore salvando lo storico:', err);
    }
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

    if (command === 'storico') {
        const storico = leggiStorico();
        if (storico.length === 0) {
            message.channel.send('Nessun dato disponibile nello storico.');
            return;
        }

        const formattato = storico.map(entry => 
            `**${entry.nickname || entry.userId}**\n` +
            `- Entrata: ${entry.entrata}\n` +
            `- Uscita: ${entry.uscita || 'Ancora in servizio'}\n` +
            `- Durata: ${entry.durata || 'N/A'}`
        ).join('\n\n');

        message.channel.send('Storico completo degli utenti:\n\n' + formattato);
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

            const storico = leggiStorico();
            storico.push({
                userId,
                nickname,
                entrata: moment(timestampInizio).format('YYYY-MM-DD HH:mm:ss'),
                uscita: null,
                durata: null
            });
            scriviStorico(storico);

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
            const timestampUscita = Date.now();
            const durataServizio = moment.duration(timestampUscita - timestampInizio).humanize();
            utentiInServizio.delete(userId);

            const storico = leggiStorico();
            const indice = storico.findIndex(entry => entry.userId === userId && !entry.uscita);
            if (indice !== -1) {
                storico[indice].uscita = moment(timestampUscita).format('YYYY-MM-DD HH:mm:ss');
                storico[indice].durata = durataServizio;
            } else {
                storico.push({
                    userId,
                    nickname,
                    entrata: moment(timestampInizio).format('YYYY-MM-DD HH:mm:ss'),
                    uscita: moment(timestampUscita).format('YYYY-MM-DD HH:mm:ss'),
                    durata: durataServizio
                });
            }
            scriviStorico(storico);

            await interaction.reply({ content: 'Sei ora fuori servizio!', ephemeral: true });

            const serviceChannel = interaction.guild.channels.cache.find(channel => channel.name === 'utenti-in-servizio');
            if (serviceChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`${nickname}`)
                    .setDescription(`è uscito dal servizio\n\n**Entrata:** ${moment(timestampInizio).format('HH:mm:ss')}\n**Uscita:** ${moment(timestampUscita).format('HH:mm:ss')}\n**Durata:** ${durataServizio}`)
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] }).catch(err => console.error(`Errore inviando il messaggio: ${err}`));
            } else {
                console.error('Canale utenti-in-servizio non trovato.'); // Debug
            }
        }
    }
});

client.login(token);
