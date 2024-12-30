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
        entrata: moment(orario).format('YYYY-MM-DD HH:mm:ss'),
        uscita: null,
        durata: null
    }));

    fs.readFile('storicoUtenti.json', 'utf8', (err, data) => {
        let datiEsistenti = [];
        if (!err && data) {
            datiEsistenti = JSON.parse(data); // Carica lo storico esistente
        }
        const nuovoStorico = [...datiEsistenti, ...datiUtenti];

        fs.writeFile('storicoUtenti.json', JSON.stringify(nuovoStorico, null, 2), (err) => {
            if (err) {
                console.error('Errore salvando lo storico:', err);
            } else {
                console.log('Storico aggiornato correttamente.');
            }
        });
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
        fs.readFile('storicoUtenti.json', 'utf8', (err, data) => {
            if (err) {
                message.channel.send('Errore leggendo lo storico. Assicurati che esista.');
                console.error('Errore leggendo lo storico:', err);
            } else {
                try {
                    const storico = JSON.parse(data);
                    const formattato = storico.map(entry => 
                        `**${entry.nickname || entry.userId}**\n` +
                        `- Entrata: ${entry.entrata}\n` +
                        `- Uscita: ${entry.uscita || 'Ancora in servizio'}\n` +
                        `- Durata: ${entry.durata || 'N/A'}`
                    ).join('\n\n');
                    message.channel.send('Storico completo degli utenti:\n\n' + formattato);
                } catch (parseErr) {
                    message.channel.send('Errore analizzando lo storico.');
                    console.error('Errore analizzando lo storico:', parseErr);
                }
            }
        });
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
            const timestampUscita = Date.now();
            const durataServizio = moment.duration(timestampUscita - timestampInizio).humanize();
            utentiInServizio.delete(userId);

            fs.readFile('storicoUtenti.json', 'utf8', (err, data) => {
                let storico = [];
                if (!err && data) {
                    storico = JSON.parse(data);
                }

                storico.push({
                    userId,
                    nickname,
                    entrata: moment(timestampInizio).format('YYYY-MM-DD HH:mm:ss'),
                    uscita: moment(timestampUscita).format('YYYY-MM-DD HH:mm:ss'),
                    durata: durataServizio
                });

                fs.writeFile('storicoUtenti.json', JSON.stringify(storico, null, 2), (err) => {
                    if (err) {
                        console.error('Errore aggiornando lo storico:', err);
                    } else {
                        console.log('Storico aggiornato correttamente.');
                    }
                });
            });

            salvaDatiSuJSON();

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
