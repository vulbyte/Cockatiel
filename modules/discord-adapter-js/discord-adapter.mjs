import { Client, GatewayIntentBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { CockatielClient } from '../../lib-cockatiel/javascript/lib-cockatiel.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration path
const CONFIG_PATH = path.join(__dirname, 'discord-config.json');

// Check for --new flag to force reinitialization
const forceNew = process.argv.includes('--new');

// Interactive prompt helper
async function promptUser(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans.trim());
  }));
}

async function loadConfig() {
  if (forceNew && fs.existsSync(CONFIG_PATH)) {
    console.log('[Cockatiel]: --new flag detected. Removing existing configuration...');
    try {
      fs.unlinkSync(CONFIG_PATH);
    } catch (e) {
      console.warn('[Cockatiel]: Could not delete existing config file.');
    }
  }

  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.warn('[Cockatiel]: Failed to parse existing config, prompting for new values.');
    }
  }

  console.log('[Cockatiel]: No configuration found for Discord adapter. Starting setup wizard...');
  const token = await promptUser('Enter Discord Bot Token: ');
  const guildId = await promptUser('Enter the Discord Server (Guild) ID to listen on: ');
  const channelId = await promptUser('Enter the Discord Channel ID to listen on: ');
  const pin = await promptUser('Enter Engine Pairing PIN: [957]: ') || '957';
  const priority = await promptUser('Enter module priority (lower = higher priority) [10]: ') || '10';
  const engineWsUrl = await promptUser('Enter Engine WebSocket URL [ws://127.0.0.1:9734]: ') || 'ws://127.0.0.1:9734';

  const config = {
    token,
    guildId,
    channelId,
    pin: parseInt(pin, 10),
    priority: parseInt(priority, 10),
    engineWsUrl
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`[Cockatiel]: Configuration saved to ${CONFIG_PATH}`);
  return config;
}

async function main() {
  const config = await loadConfig();

  console.log('[Cockatiel]: Initializing protobuf definitions & connecting client...');

  const engineWsUrl = config.engineWsUrl || 'ws://127.0.0.1:9734';
  const protoPath = path.resolve(__dirname, '../../proto/cockatiel_protobuf.proto');

  try {
    // 1. Instantiate client with module name matching config.json expectations
    const cockatiel = new CockatielClient(
      engineWsUrl,
      protoPath,
      'discord_bridge'
    );

    // 2. Explicitly initialize protobuf definitions
    await cockatiel.init();

    // 3. Register a receiver callback for debugging incoming traffic
    cockatiel.receive('connectionRequestReturn', (res) => {
      console.log('[Cockatiel]: Connection handshake acknowledged by engine:', res);
    });

    // 4. Await connection and authentication handshake.
    // Registered as 'input': this bridge is a raw source adapter feeding the
    // pipeline, not a preprocess/inprocess/postprocess transform stage, so it
    // shouldn't be inserted into those dispatch lists on the engine side.
    console.log(`[Cockatiel]: Connecting to engine WebSocket (Using PIN: ${config.pin})...`);
    await cockatiel.connect(config.pin, 'input', config.priority || 10);
    console.log('[Cockatiel]: Discord Bridge Connected and authenticated successfully.');

    // Initialize Discord Client
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ]
    });

    client.once('ready', (c) => {
      console.log(`[Discord]: Logged in successfully as ${c.user.tag}`);
      console.log(`[Discord]: Watching guild ${config.guildId}, channel ${config.channelId}`);
    });

    // Handle incoming messages from Discord and push them into the pipeline
    client.on('messageCreate', async (message) => {
      if (message.author.bot) return;

      // Only forward messages from the configured server + channel.
      if (!message.guild || message.guild.id !== config.guildId) return;
      if (message.channel.id !== config.channelId) return;

      console.log(`[Discord Message Seen] [${message.author.username}]: ${message.content}`);

      try {
        // MessagePreProcess only defines: platform, raw_data, raw_message.
        // raw_message must be the untouched user text (per the schema's own
        // comment); anything else about the message goes in raw_data as a
        // JSON string, since raw_data is explicitly meant for arbitrary
        // platform-specific key/value data.
        cockatiel.send('messagePreProcess', {
          platform: 'discord',
          rawMessage: message.content,
          rawData: JSON.stringify({
            guildId: message.guild.id,
            channelId: message.channel.id,
            messageId: message.id,
            authorId: message.author.id,
            authorName: message.author.username,
            timestamp: message.createdTimestamp
          })
        });
        console.log(`[Discord Adapter] Forwarded message from ${message.author.username} to engine pipeline.`);
      } catch (error) {
        console.error("[Discord Adapter] Error processing incoming message:", error);
      }
    });

    // Handle downstream messages coming back from the engine.
    // NOTE: because this connection is registered as 'input' above, the engine
    // only broadcasts finished MessagePostProcess containers to modules listed
    // under postprocessModules in config.json - an 'input' module is never
    // added to that list, so this callback will not currently fire. It's left
    // wired up correctly (using the real field name, processedMessage, not the
    // old nonexistent 'content') for when you add a second connection/module
    // registered as 'postprocess' to actually post replies back into Discord.
    cockatiel.receive('messagePostProcess', async (msg) => {
      try {
        if (msg.platform !== 'discord' || !msg.processedMessage) return;
        const channel = await client.channels.fetch(config.channelId);
        if (channel) {
          await channel.send(msg.processedMessage);
        }
      } catch (e) {
        console.error('[Discord Adapter] Error handling downstream engine message:', e);
      }
    });

    // Log into Discord gateway
    await client.login(config.token);

    // Keep process alive and catch WS drops
    process.on('SIGINT', () => {
      console.log('[Cockatiel]: Shutting down Discord bridge...');
      process.exit(0);
    });

  } catch (initError) {
    console.error('[Cockatiel Connection Error]: Failed during client init or connection.', initError);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[Cockatiel Fatal Error]:', err);
  process.exit(1);
});

