import { Client, GatewayIntentBits } from 'discord.js';

import { CockatielClient } from '../../lib-cockatiel/javascript/lib-cockatiel.mjs';
import { v7 as uuidv7 } from 'uuid';
import fs from 'fs';
import path from 'path';

// --- CLI Argument Parser for Automation ---
function getArg(flag) {
    const args = process.argv.slice(2);
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : null;
}

const CONFIG_PATH = path.resolve('./discord-config.json');

// --- Auto-Generate, Load, and Sync Config with CLI Flags ---
function loadOrUpdateConfig() {
    let fileConfig;

    if (!fs.existsSync(CONFIG_PATH)) {
        console.log('[Discord Module]: discord-config.json not found. Generating default config...');
        fileConfig = {
            token: "YOUR_DISCORD_BOT_TOKEN",
            guildId: "YOUR_SERVER_ID",
            channelId: "YOUR_CHANNEL_ID",
            cockatielPin: 123456,
            priority: 10,
            engineWsUrl: "ws://127.0.0.1:9734"
        };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(fileConfig, null, 4));
        console.log(`[Discord Module]: Config created at ${CONFIG_PATH}. Please update it or pass flags.`);
    } else {
        const fileData = fs.readFileSync(CONFIG_PATH, 'utf-8');
        try {
            fileConfig = JSON.parse(fileData);
        } catch (e) {
            console.error('[Discord Module]: Failed to parse discord-config.json. Ensure it is valid JSON.');
            process.exit(1);
        }
    }

    let configUpdated = false;

    // Check CLI arguments and override/save back to JSON if provided
    const tokenArg = getArg('-token');
    if (tokenArg && tokenArg !== fileConfig.token) {
        fileConfig.token = tokenArg;
        configUpdated = true;
    }

    const guildArg = getArg('-guild');
    if (guildArg && guildArg !== fileConfig.guildId) {
        fileConfig.guildId = guildArg;
        configUpdated = true;
    }

    const channelArg = getArg('-channel');
    if (channelArg && channelArg !== fileConfig.channelId) {
        fileConfig.channelId = channelArg;
        configUpdated = true;
    }

    const pinArg = getArg('-pin');
    if (pinArg && parseInt(pinArg, 10) !== fileConfig.cockatielPin) {
        fileConfig.cockatielPin = parseInt(pinArg, 10);
        configUpdated = true;
    }

    const priorityArg = getArg('-priority');
    if (priorityArg && parseInt(priorityArg, 10) !== fileConfig.priority) {
        fileConfig.priority = parseInt(priorityArg, 10);
        configUpdated = true;
    }

    const urlArg = getArg('-url');
    if (urlArg && urlArg !== fileConfig.engineWsUrl) {
        fileConfig.engineWsUrl = urlArg;
        configUpdated = true;
    }

    // If flags were passed that differed from the file, save them persistently
    if (configUpdated) {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(fileConfig, null, 4));
        console.log('[Discord Module]: Updated and saved new values to discord-config.json from CLI flags.');
    }

    return fileConfig;
}

// CLI flags can override config file values for automation/scripting
const fileConfig = loadOrUpdateConfig();

// Directly use the fully resolved configuration object
const DISCORD_TOKEN = fileConfig.token;
const TARGET_GUILD_ID = fileConfig.guildId;
const TARGET_CHANNEL_ID = fileConfig.channelId;
const COCKATIEL_PIN = fileConfig.cockatielPin;
const MODULE_PRIORITY = fileConfig.priority;
const ENGINE_WS_URL = fileConfig.engineWsUrl;

const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const cockatiel = new CockatielClient(
    ENGINE_WS_URL, 
    path.resolve('../../proto/cockatiel_protobuf.proto'), 
    'discord_bridge'
);

async function start() {
    await cockatiel.init();
    
    console.log('[Cockatiel]: Connecting Discord bridge to engine...');
    await cockatiel.connect(COCKATIEL_PIN, 'preprocess', MODULE_PRIORITY);
    console.log('[Cockatiel]: Discord Bridge Connected successfully.');

    cockatiel.receive('messageProcessed', async (data) => {
        const processed = data.messageProcessed;
        if (processed.platform === 'discord' && processed.isFinal) {
            try {
                const channel = await discordClient.channels.fetch(TARGET_CHANNEL_ID);
                channel.send(processed.processedMessage);
            } catch (err) {
                console.error('[Discord]: Failed to send processed message to channel:', err);
            }
        }
    });

    discordClient.once('ready', () => {
        console.log(`[Discord]: Logged in as ${discordClient.user.tag}`);
    });

    discordClient.on('messageCreate', (message) => {
        if (message.author.bot || message.guildId !== TARGET_GUILD_ID || message.channelId !== TARGET_CHANNEL_ID) return;

        const timelineObj = {
            c: message.content.startsWith('!') ? message.content.split(' ')[0] : "",
            d: null,
            e: "",
            f: "",
            i: uuidv7(),
            o: "discord",
            p: "",
            r: message.content,
            s: TARGET_CHANNEL_ID,
            t: "usermessage",
            u: message.author.id,
            v: 1
        };

        cockatiel.send('messageRaw', {
            jsonData: JSON.stringify(timelineObj)
        });
    });

    discordClient.login(DISCORD_TOKEN);
}

start().catch(console.error);
