const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const moment = require('moment'); // Per gestire date e orari

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const token = 'MTMyMDY5MTE4NzE4Njc5ODYwMg.GdjM_h.0kIvMVkC72b_v6IciYklEaajq4os2liGdi-JfY';

const utentiInServizio = new Map(); // Per tracciare gli utenti in servizio

client.once('ready', () => {
    console.log(Bot ${client.user.tag} è online!);
});

client.on('messageCreate', async (message) => {
    if (message.channel.name === 'cartellino' && !message.author.bot) {
        // Cancella tutti i messaggi nel canale, tranne il messaggio con i pulsanti
        const fetchedMessages = await message.channel.messages.fetch({ limit: 100 });
        fetchedMessages.forEach(msg => {
            if (msg.author.bot && msg.components.length === 0) {
                msg.delete().catch(err => console.error(Errore eliminando messaggio: ${err}));
            }
        });

        // Creazione dei pulsanti
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

        // Invia il messaggio con i pulsanti solo se non esiste già
        const botMessages = fetchedMessages.filter(msg => msg.author.bot && msg.components.length > 0);
        if (botMessages.size === 0) {
            await message.channel.send({ content: 'Scegli un\'azione:', components: [row] });
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id); // Ottieni il membro del server
    const nickname = member ? member.displayName : interaction.user.username; // Usa il nickname, se esiste, altrimenti il nome utente
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
                // Crea un embed per l'ingresso
                const embed = new EmbedBuilder()
                    .setColor('#008000') // Colore verde
                    .setTitle(${nickname}) // Solo il nome/nickname nella prima riga
                    .setDescription(è entrato in servizio\n\n**Data:** ${timestamp})
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
                // Crea un embed per l'uscita
                const embed = new EmbedBuilder()
                    .setColor('#FF0000') // Colore rosso
                    .setTitle(${nickname}) // Solo il nome/nickname nella prima riga
                    .setDescription(è uscito dal  servizio\n\n**Data:** ${timestamp})
                    .setFooter({ text: 'Ospedale Umberto Primo' });

                serviceChannel.send({ embeds: [embed] });
            }
        }
    }
});

client.login(token);
