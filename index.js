const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
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

// Middleware для парсинга JSON
app.use(express.json());

// Счетчик сообщений для каждого пользователя
const messageCounters = new Map();

// Обработчик входящих сообщений от Telegram
app.post('/webhook', (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      handleMessage(update.message);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Функция обработки сообщений
function handleMessage(message) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = message.text;
  
  // Получаем информацию о пользователе
  const user = message.from;
  const userName = user.first_name || user.username || 'Неизвестный пользователь';
  const userLastName = user.last_name ? ` ${user.last_name}` : '';
  const fullUserName = `${userName}${userLastName}`;
  
  // Увеличиваем счетчик сообщений для пользователя
  const userId = user.id;
  const currentCount = messageCounters.get(userId) || 0;
  const newCount = currentCount + 1;
  messageCounters.set(userId, newCount);
  
  // Формируем ответ
  const response = `📨 Сообщение #${newCount}
👤 Пользователь: ${fullUserName}
💬 Текст: ${text || '[Нет текста]'}`;
  
  // Отправляем ответ
  bot.sendMessage(chatId, response)
    .then(() => {
      console.log(`Отправлен ответ пользователю ${fullUserName} (ID: ${userId})`);
    })
    .catch((error) => {
      console.error('Ошибка при отправке сообщения:', error);
    });
}

// Обработчик команды /start
app.post('/webhook', (req, res) => {
  try {
    const update = req.body;
    
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      
      if (message.text === '/start') {
        const welcomeMessage = `🤖 Добро пожаловать в тестовый бот!
        
Этот бот будет отвечать на ваши сообщения, показывая:
• Номер сообщения
• Ваше имя
• Текст сообщения

Просто отправьте любое сообщение!`;
        
        bot.sendMessage(chatId, welcomeMessage)
          .then(() => {
            console.log(`Отправлено приветствие пользователю ${message.from.first_name}`);
          })
          .catch((error) => {
            console.error('Ошибка при отправке приветствия:', error);
          });
      } else {
        handleMessage(message);
      }
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
