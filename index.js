const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const SupabaseClient = require('./src/supabase/client');
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
} catch (error) {
  console.error('Ошибка инициализации Supabase клиента:', error.message);
}

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
    case '/accounts_upd':
      handleAccountsUpdCommand(chatId, userName);
      break;
    default:
      bot.sendMessage(chatId, 'Неизвестная команда. Используйте /start для начала работы.');
  }
}

// Обработчик команды /start
function handleStartCommand(chatId, userName) {
  const welcomeMessage = `Добро пожаловать в ZenMoney Bot, ${userName}!

Доступные команды:
/start - приветствие
/accounts - показать все счета из ZenMoney
/accounts_upd - обновить счета в Supabase

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
    bot.sendMessage(chatId, 'ZenMoney API не настроен. Проверьте переменную ZENMONEY_TOKEN.');
    return;
  }
  
  try {
    // Отправляем сообщение о загрузке
    const loadingMessage = await bot.sendMessage(chatId, 'Загружаем счета из ZenMoney...');
    
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
      await bot.editMessageText('Счета не найдены', {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Удаляем сообщение о загрузке
    await bot.deleteMessage(chatId, loadingMessage.message_id);
    
    // Отправляем каждый счет отдельным сообщением
    const accountList = Object.values(accounts);
    
    for (let i = 0; i < accountList.length; i++) {
      const account = accountList[i];
      const accountText = formatAccountDetails(account, i + 1, accountList.length);
      
      await bot.sendMessage(chatId, accountText);
      
      // Небольшая задержка между сообщениями для избежания rate limiting
      if (i < accountList.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`Отправлен список счетов пользователю ${userName} (${Object.keys(accounts).length} счетов)`);
    
  } catch (error) {
    console.error('Ошибка при получении счетов:', error);
    await bot.editMessageText('Ошибка при получении счетов из ZenMoney. Проверьте токен и попробуйте позже.', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
  }
}

// Функция для форматирования деталей счета
function formatAccountDetails(account, index, total) {
  let text = `💳 Счет ${index} из ${total}\n\n`;
  
  // Добавляем все поля счета в формате ".. ИмяПараметра: ЗначениеПараметра"
  const fields = [
    'id', 'user', 'instrument', 'type', 'role', 'private', 'savings', 
    'title', 'inBalance', 'creditLimit', 'startBalance', 'balance', 
    'company', 'archive', 'enableCorrection', 'balanceCorrectionType', 
    'startDate', 'capitalization', 'percent', 'changed', 'syncID', 
    'enableSMS', 'endDateOffset', 'endDateOffsetInterval', 'payoffStep', 'payoffInterval'
  ];
  
  fields.forEach(field => {
    const value = account[field];
    if (value !== undefined && value !== null) {
      let displayValue = value;
      
      // Специальная обработка для некоторых полей
      if (field === 'changed' && typeof value === 'number') {
        displayValue = new Date(value * 1000).toLocaleString('ru-RU');
      } else if (field === 'balance' || field === 'startBalance' || field === 'creditLimit') {
        // Форматируем денежные суммы
        displayValue = `${value} (${(value / 100).toFixed(2)} руб.)`;
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'да' : 'нет';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }
      
      text += `.. ${field}: ${displayValue}\n`;
    }
  });
  
  return text;
}

// Обработчик команды /accounts_upd
async function handleAccountsUpdCommand(chatId, userName) {
  const zenMoneyToken = process.env.ZENMONEY_TOKEN;
  
  if (!zenMoneyToken) {
    bot.sendMessage(chatId, 'ZenMoney API не настроен. Проверьте переменную ZENMONEY_TOKEN.');
    return;
  }
  
  if (!supabaseClient) {
    bot.sendMessage(chatId, 'Supabase не настроен. Проверьте переменные SB_PROJECT_ID и SB_TOKEN.');
    return;
  }
  
  // Объявляем loadingMessage вне try-catch для доступа в catch
  let loadingMessage;
  
  try {
    // Отправляем сообщение о начале процесса
    loadingMessage = await bot.sendMessage(chatId, '🔄 Начинаем обновление счетов в Supabase...');
    
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
      await bot.editMessageText('❌ Счета не найдены в ZenMoney', {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Обновляем статус
    await bot.editMessageText('🔄 Получены счета из ZenMoney. Очищаем таблицу в Supabase...', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    // Очищаем таблицу в Supabase
    const clearResult = await supabaseClient.clearAccounts();
    if (!clearResult.success) {
      await bot.editMessageText(`❌ Ошибка при очистке таблицы: ${clearResult.error}`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Обновляем статус
    await bot.editMessageText('🔄 Таблица очищена. Загружаем счета в Supabase...', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    // Преобразуем счета для Supabase
    const accountsForSupabase = Object.values(accounts).map(account => {
      // Безопасная обработка даты
      let startDate = null;
      if (account.startDate && typeof account.startDate === 'number' && account.startDate > 0) {
        try {
          const date = new Date(account.startDate * 1000);
          if (!isNaN(date.getTime())) {
            startDate = date.toISOString().split('T')[0];
          }
        } catch (error) {
          console.warn(`Неверная дата startDate для счета ${account.id}:`, account.startDate);
        }
      }

      return {
        id: account.id,
        user_id: account.user,
        instrument_id: account.instrument,
        type: account.type,
        title: account.title,
        balance: account.balance || 0,
        start_balance: account.startBalance || 0,
        credit_limit: account.creditLimit || 0,
        in_balance: account.inBalance !== false,
        private: account.private === true,
        savings: account.savings === true,
        archive: account.archive === true,
        enable_correction: account.enableCorrection !== false,
        enable_sms: account.enableSMS === true,
        balance_correction_type: account.balanceCorrectionType,
        capitalization: account.capitalization,
        percent: account.percent,
        start_date: startDate,
        end_date_offset: account.endDateOffset,
        end_date_offset_interval: account.endDateOffsetInterval,
        payoff_step: account.payoffStep,
        payoff_interval: account.payoffInterval,
        company_id: account.company,
        role: account.role,
        sync_id: account.syncID,
        changed: account.changed
      };
    });
    
    // Вставляем счета в Supabase
    const insertResult = await supabaseClient.insertAccounts(accountsForSupabase);
    if (!insertResult.success) {
      await bot.editMessageText(`❌ Ошибка при загрузке счетов: ${insertResult.error}`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Успешное завершение
    await bot.editMessageText(`✅ Счета успешно обновлены в Supabase!\n\n📊 Загружено: ${accountsForSupabase.length} счетов`, {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    console.log(`Счета обновлены в Supabase пользователем ${userName} (${accountsForSupabase.length} счетов)`);
    
  } catch (error) {
    console.error('Ошибка при обновлении счетов:', error);
    
    // Проверяем, что loadingMessage существует перед попыткой редактирования
    if (loadingMessage) {
      try {
        await bot.editMessageText('❌ Ошибка при обновлении счетов. Проверьте настройки и попробуйте позже.', {
          chat_id: chatId,
          message_id: loadingMessage.message_id
        });
      } catch (editError) {
        console.error('Ошибка при редактировании сообщения:', editError);
        // Если не удалось отредактировать, отправляем новое сообщение
        bot.sendMessage(chatId, '❌ Ошибка при обновлении счетов. Проверьте настройки и попробуйте позже.');
      }
    } else {
      // Если loadingMessage не определена, отправляем новое сообщение
      bot.sendMessage(chatId, '❌ Ошибка при обновлении счетов. Проверьте настройки и попробуйте позже.');
    }
  }
}

// Вспомогательные функции

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
