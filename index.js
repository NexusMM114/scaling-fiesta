require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Client, GatewayIntentBits } = require('discord.js');

const app = express();
app.use(cors());
app.use(express.json()); // Parse JSON bodies

// --- 1. CONFIGURATION & SECURITY ---
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'nexus123';

// Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'Access denied. No token provided.' });

    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

// --- 2. DATABASE SETUP ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nexus')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.log('❌ DB Error:', err));

const Lobby = mongoose.model('Lobby', new mongoose.Schema({
  title: String,
  version: String,
  tags: [String],
  imageUrl: String
}, { timestamps: true }));

// --- 3. EXPRESS API ROUTES ---

// Login Route
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '12h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Incorrect password' });
    }
});

// Get all lobbies (Public)
app.get('/api/lobbies', async (req, res) => {
  const lobbies = await Lobby.find().sort({ createdAt: -1 });
  res.json(lobbies);
});

// Add a new lobby (Protected: Admin Only)
app.post('/api/lobbies', verifyAdmin, async (req, res) => {
  try {
      const lobby = new Lobby(req.body);
      await lobby.save();
      res.json(lobby);
  } catch (err) {
      res.status(500).json({ error: 'Failed to upload lobby' });
  }
});

// Serve the frontend file for BOTH main and admin routes
app.get(['/', '/admin'], (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// --- 4. DISCORD BOT ---
const bot = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

bot.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith('!')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'lobbies') {
    const lobbies = await Lobby.find().limit(5);
    if (lobbies.length === 0) return message.reply('No lobbies found.');
    message.reply(lobbies.map(l => `**${l.title}** (v${l.version})`).join('\n'));
  }
});

if (process.env.DISCORD_TOKEN) {
    bot.login(process.env.DISCORD_TOKEN).then(() => console.log('✅ Discord Bot Online'));
}

// --- 5. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Nexus Server running on port ${PORT}`));


    
