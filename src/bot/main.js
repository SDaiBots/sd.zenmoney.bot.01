const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const SupabaseClient = require('../database/supabase/client');
const { handleStartCommand } = require('./handlers/commands');
const { handleTransactionWithAI, handleTokenInput } = require('./handlers/messages');
const { handleVoiceMessage } = require('./handlers/voice');
const { isUserAuthorized } = require('./middleware/auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация Telegram бота
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('Ошибка: TELEGRAM_BOT_TOKEN не установлен в переменных окружения');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

// Инициализация Supabase клиента
let supabaseClient;
try {
  supabaseClient = new SupabaseClient();
  console.log('✅ Supabase клиент успешно инициализирован');
} catch (error) {
  console.error('❌ Ошибка инициализации Supabase клиента:', error.message);
  console.error('❌ Детали ошибки:', error);
}

// Middleware для парсинга JSON
app.use(express.json());

// Счетчик сообщений для каждого пользователя
const messageCounters = new Map();

// Хранилище исходных тегов от ИИ для каждого сообщения
const aiTagsStorage = new Map();

/**
 * Функция обработки сообщений
 */
async function handleMessage(message) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = message.text;
  const voice = message.voice;
  
  // Получаем информацию о пользователе
  const user = message.from;
  const userName = user.first_name || user.username || 'Неизвестный пользователь';
  const userLastName = user.last_name ? ` ${user.last_name}` : '';
  const fullUserName = `${userName}${userLastName}`;
  
  // Проверяем авторизацию пользователя
  const authResult = await isUserAuthorized(supabaseClient, user.id, user.username);
  
  if (!authResult.authorized) {
    console.log(`🚫 Неавторизованный пользователь: ${fullUserName} (ID: ${user.id})`);
    
    // Отправляем сообщение с информацией для администратора
    const adminMessage = `Ваш логин: ${user.username || 'не указан'}
Ваш Telegram ID: ${user.id}

Перешлите это сообщение администратору, чтобы он добавил вас в группу тестирования`;
    
    await bot.sendMessage(chatId, adminMessage, {
      reply_to_message_id: messageId
    });
    return;
  }

  const currentUser = authResult.user;
  
  // Обработка команд
  if (text && text.startsWith('/')) {
    await handleCommand(message, currentUser);
    return;
  }
  
  // Обработка токена ZenMoney (если пользователь не имеет токена)
  if (!currentUser.zenmoney_token && text && !text.startsWith('/')) {
    await handleTokenInput(bot, supabaseClient, chatId, text, currentUser, messageId);
    return;
  }
  
  // Обработка голосовых сообщений
  if (voice) {
    await handleVoiceMessage(bot, supabaseClient, aiTagsStorage, token, chatId, voice, user, fullUserName, messageId, currentUser);
    return;
  }
  
  // Обработка обычных сообщений - показываем структуру транзакции с ИИ-анализом
  if (text) {
    await handleTransactionWithAI(bot, supabaseClient, aiTagsStorage, chatId, text, user, fullUserName, false, messageId, currentUser);
  }
}

/**
 * Функция обработки команд
 */
async function handleCommand(message, currentUser = null) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = message.text;
  const user = message.from;
  
  switch (text) {
    case '/start':
      await handleStartCommand(bot, supabaseClient, chatId, user, messageId);
      break;
    default:
      await bot.sendMessage(chatId, 'Неизвестная команда. Используйте /start для начала работы.', {
        reply_to_message_id: messageId
      });
  }
}

// Обработчик входящих сообщений от Telegram
app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      await handleMessage(update.message);
    }
    
    if (update.callback_query) {
      // TODO: Добавить обработчик callback_query
      console.log('Callback query received:', update.callback_query);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Базовый endpoint для проверки работы сервера
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Telegram Bot is running',
    timestamp: new Date().toISOString()
  });
});

// Endpoint для получения информации о боте
app.get('/bot-info', (req, res) => {
  bot.getMe()
    .then((botInfo) => {
      res.json({
        bot: botInfo,
        users: messageCounters.size,
        totalMessages: Array.from(messageCounters.values()).reduce((sum, count) => sum + count, 0)
      });
    })
    .catch((error) => {
      console.error('Ошибка при получении информации о боте:', error);
      res.status(500).json({ error: 'Failed to get bot info' });
    });
});

// Обработчик ошибок
app.use((error, req, res, next) => {
  console.error('Необработанная ошибка:', error);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📱 Webhook endpoint: http://localhost:${PORT}/webhook`);
  console.log(`ℹ️  Bot info endpoint: http://localhost:${PORT}/bot-info`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Получен сигнал SIGTERM, завершение работы...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Получен сигнал SIGINT, завершение работы...');
  process.exit(0);
});

module.exports = app;
