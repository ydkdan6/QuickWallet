require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const MessageHandler = require('./src/handlers/messageHandler');

// Validate required environment variables
const requiredEnvVars = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_URL', 'SUPABASE_KEY'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));
  console.error('Please check your .env file or Railway environment variables.');
  process.exit(1);
}

// Initialize bot
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Initialize message handler
const messageHandler = new MessageHandler(bot);

// Bot event handlers
bot.on('message', async (msg) => {
  try {
    await messageHandler.handleMessage(msg);
  } catch (error) {
    console.error('Error handling message:', error);
    await bot.sendMessage(msg.chat.id, 
      '❌ Sorry, something went wrong. Please try again later.'
    );
  }
});

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('🤖 Telegram QuickWallet is running...');
console.log('🤖 QuickWallet Bot is running...');
console.log('📱 Bot is ready to receive messages!');