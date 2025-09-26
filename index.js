const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
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
  
  // Обработка команд
  if (text && text.startsWith('/')) {
    handleCommand(message);
    return;
  }
  
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

// Функция обработки команд
function handleCommand(message) {
  const chatId = message.chat.id;
  const text = message.text;
  const user = message.from;
  const userName = user.first_name || user.username || 'Неизвестный пользователь';
  
  switch (text) {
    case '/start':
      handleStartCommand(chatId, userName);
      break;
    case '/accounts':
      handleAccountsCommand(chatId, userName);
      break;
    default:
      bot.sendMessage(chatId, '❓ Неизвестная команда. Используйте /start для начала работы.');
  }
}

// Обработчик команды /start
function handleStartCommand(chatId, userName) {
  const welcomeMessage = `🤖 Добро пожаловать в ZenMoney Bot, ${userName}!

Доступные команды:
/start - приветствие
/accounts - показать все счета из ZenMoney

Просто отправьте любое сообщение для тестирования!`;
  
  bot.sendMessage(chatId, welcomeMessage)
    .then(() => {
      console.log(`Отправлено приветствие пользователю ${userName}`);
    })
    .catch((error) => {
      console.error('Ошибка при отправке приветствия:', error);
    });
}

// Обработчик команды /accounts
async function handleAccountsCommand(chatId, userName) {
  const zenMoneyToken = process.env.ZENMONEY_TOKEN;
  
  if (!zenMoneyToken) {
    bot.sendMessage(chatId, '❌ ZenMoney API не настроен. Проверьте переменную ZENMONEY_TOKEN.');
    return;
  }
  
  try {
    // Отправляем сообщение о загрузке
    const loadingMessage = await bot.sendMessage(chatId, '🔄 Загружаем счета из ZenMoney...');
    
    // Получаем данные из ZenMoney API
    const currentTimestamp = Math.floor(Date.now() / 1000);
    
    const response = await axios.post('https://api.zenmoney.ru/v8/diff', {
      currentClientTimestamp: currentTimestamp,
      serverTimestamp: 0
    }, {
      headers: {
        'Authorization': `Bearer ${zenMoneyToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PellaZenMoneyBot/1.0'
      },
      timeout: 30000
    });
    
    const data = response.data;
    const accounts = data.account || {};
    
    if (Object.keys(accounts).length === 0) {
      await bot.editMessageText('📭 Счета не найдены', {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Формируем список счетов
    let responseText = `💰 Ваши счета (${Object.keys(accounts).length}):\n\n`;
    
    Object.values(accounts).forEach((account, index) => {
      const balance = account.balance ? `${account.balance}` : '0';
      const type = getAccountTypeEmoji(account.type);
      responseText += `${index + 1}. ${type} ${account.title}\n`;
      responseText += `   💵 Баланс: ${balance}\n`;
      responseText += `   🆔 ID: ${account.id}\n\n`;
    });
    
    // Если сообщение слишком длинное, разбиваем на части
    if (responseText.length > 4000) {
      const chunks = splitMessage(responseText, 4000);
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await bot.editMessageText(chunks[i], {
            chat_id: chatId,
            message_id: loadingMessage.message_id
          });
        } else {
          await bot.sendMessage(chatId, chunks[i]);
        }
      }
    } else {
      await bot.editMessageText(responseText, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
    }
    
    console.log(`Отправлен список счетов пользователю ${userName} (${Object.keys(accounts).length} счетов)`);
    
  } catch (error) {
    console.error('Ошибка при получении счетов:', error);
    await bot.editMessageText('❌ Ошибка при получении счетов из ZenMoney. Проверьте токен и попробуйте позже.', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
  }
}

// Вспомогательные функции
function getAccountTypeEmoji(type) {
  const emojiMap = {
    'checking': '🏦',
    'ccard': '💳',
    'debt': '📊',
    'cash': '💵',
    'deposit': '🏛️',
    'loan': '🏦'
  };
  return emojiMap[type] || '💰';
}

function splitMessage(text, maxLength) {
  const chunks = [];
  let currentChunk = '';
  
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (currentChunk.length + line.length + 1 > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
      } else {
        chunks.push(line);
      }
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}


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
