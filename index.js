const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const SupabaseClient = require('./src/supabase/client');
const { analyzeMessageWithAI } = require('./src/ai/analyzer');
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
    
    if (update.callback_query) {
      handleCallbackQuery(update.callback_query);
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
  
  // Обработка обычных сообщений - показываем структуру транзакции с ИИ-анализом
  if (text) {
    handleTransactionWithAI(chatId, text, user, fullUserName);
  }
}

// Функция обработки транзакции с ИИ-анализом
async function handleTransactionWithAI(chatId, text, user, fullUserName) {
  try {
    console.log(`🤖 Начинаем ИИ-анализ сообщения от пользователя ${fullUserName}: "${text}"`);
    
    // Сначала отправляем базовую структуру транзакции
    const transactionStructure = createTransactionStructure(text, 'Бумажник');
    const inlineKeyboard = createTransactionKeyboard();
    
    const baseMessage = await bot.sendMessage(chatId, transactionStructure, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
    
    console.log(`✅ Отправлена базовая структура транзакции пользователю ${fullUserName} (ID: ${user.id})`);
    
    // Затем запускаем ИИ-анализ асинхронно
    analyzeMessageWithAI(text, supabaseClient)
      .then(async (aiResult) => {
        if (aiResult.success && aiResult.tags && aiResult.tags.length > 0) {
          console.log(`🎯 ИИ определил ${aiResult.tags.length} тегов`);
          
          // Отправляем результат ИИ-анализа
          await sendAIResponse(chatId, aiResult, text);
        } else {
          console.log('⚠️ ИИ не смог определить теги или произошла ошибка:', aiResult.error || 'Теги не найдены');
        }
      })
      .catch((error) => {
        console.error('❌ Ошибка при ИИ-анализе:', error.message);
      });
      
  } catch (error) {
    console.error('❌ Ошибка при обработке транзакции с ИИ:', error.message);
    
    // Fallback: отправляем обычную структуру транзакции
    const transactionStructure = createTransactionStructure(text, 'Бумажник');
    const inlineKeyboard = createTransactionKeyboard();
    
    bot.sendMessage(chatId, transactionStructure, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    })
    .then(() => {
      console.log(`✅ Отправлена fallback структура транзакции пользователю ${fullUserName}`);
    })
    .catch((sendError) => {
      console.error('❌ Ошибка при отправке fallback структуры:', sendError);
    });
  }
}

// Функция отправки ответа ИИ
async function sendAIResponse(chatId, aiResult, originalMessage) {
  try {
    const tags = aiResult.tags || [];
    const primaryTag = aiResult.primaryTag;
    
    if (tags.length === 0) {
      const aiMessage = `🤖 **ИИ не смог определить категорию**

🔧 **Модель:** ${aiResult.aiSettings.provider} (${aiResult.aiSettings.model})

💡 Попробуйте более конкретное описание или используйте кнопки в основном сообщении.`;
      
      await bot.sendMessage(chatId, aiMessage);
      console.log('✅ Отправлен ответ ИИ: категория не определена');
      return;
    }
    
    // Формируем сообщение
    let aiMessage;
    if (tags.length === 1) {
      // Один вариант - однозначное сопоставление
      aiMessage = `🤖 **ИИ определил категорию:** ${primaryTag.title}
      
📊 **Уверенность:** ${Math.round(aiResult.confidence * 100)}%
🔧 **Модель:** ${aiResult.aiSettings.provider} (${aiResult.aiSettings.model})

✅ Однозначное сопоставление - других вариантов нет.`;
    } else {
      // Несколько вариантов
      aiMessage = `🤖 **ИИ определил категорию:** ${primaryTag.title}
      
📊 **Уверенность:** ${Math.round(aiResult.confidence * 100)}%
🔧 **Модель:** ${aiResult.aiSettings.provider} (${aiResult.aiSettings.model})

💡 Найдено ${tags.length} вариантов. Выберите подходящий:`;
    }
    
    // Создаем инлайн кнопки с вариантами тегов (максимум 5)
    const inlineKeyboard = createAITagsKeyboard(tags.slice(0, 5));
    
    await bot.sendMessage(chatId, aiMessage, {
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
    
    console.log(`✅ Отправлен ответ ИИ с ${tags.length} вариантами тегов`);
    
  } catch (error) {
    console.error('❌ Ошибка при отправке ответа ИИ:', error.message);
  }
}

// Функция создания инлайн клавиатуры с вариантами тегов ИИ
function createAITagsKeyboard(tags) {
  const keyboard = [];
  
  // Создаем кнопки по 2 в ряду
  for (let i = 0; i < tags.length; i += 2) {
    const row = [];
    
    // Первая кнопка в ряду
    row.push({
      text: `🎯 ${tags[i].title}`,
      callback_data: `ai_tag_${tags[i].id}`
    });
    
    // Вторая кнопка в ряду (если есть)
    if (i + 1 < tags.length) {
      row.push({
        text: `🎯 ${tags[i + 1].title}`,
        callback_data: `ai_tag_${tags[i + 1].id}`
      });
    }
    
    keyboard.push(row);
  }
  
  return keyboard;
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
    case '/tags_upd':
      handleTagsUpdCommand(chatId, userName);
      break;
    case '/ai_settings':
      handleAISettingsCommand(chatId, userName);
      break;
    case '/ai_test':
      handleAITestCommand(chatId, userName);
      break;
    default:
      bot.sendMessage(chatId, 'Неизвестная команда. Используйте /start для начала работы.');
  }
}

// Обработчик команды /start
function handleStartCommand(chatId, userName) {
  const welcomeMessage = `Добро пожаловать в ZenMoney Bot, ${userName}!

💰 **Основной функционал:**
Отправьте любое сообщение, и бот покажет структуру транзакции с ИИ-анализом категории и возможностью применить, отменить или скорректировать.

🤖 **ИИ-функции:**
Бот автоматически анализирует ваши сообщения и предлагает подходящую категорию расхода/дохода.

📋 **Доступные команды:**
/start - приветствие
/accounts - показать все счета из ZenMoney
/accounts_upd - обновить счета в Supabase
/tags_upd - обновить теги в Supabase
/ai_settings - настройки ИИ
/ai_test - тестирование ИИ

💡 **Как использовать:**
Просто отправьте сообщение с описанием траты, например: "Купил хлеб в магазине"`;
  
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

// Обработчик команды /tags_upd
async function handleTagsUpdCommand(chatId, userName) {
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
    loadingMessage = await bot.sendMessage(chatId, '🔄 Начинаем обновление тегов в Supabase...');
    
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
    const tags = data.tag || {};
    
    if (Object.keys(tags).length === 0) {
      await bot.editMessageText('❌ Теги не найдены в ZenMoney', {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Обновляем статус
    await bot.editMessageText('🔄 Получены теги из ZenMoney. Очищаем таблицу в Supabase...', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    // Очищаем таблицу в Supabase
    const clearResult = await supabaseClient.clearTags();
    if (!clearResult.success) {
      await bot.editMessageText(`❌ Ошибка при очистке таблицы: ${clearResult.error}`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Обновляем статус
    await bot.editMessageText('🔄 Таблица очищена. Загружаем теги в Supabase...', {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    // Преобразуем теги для Supabase
    const tagsForSupabase = Object.values(tags).map(tag => {
      // Безопасная обработка даты changed
      let changedDate = null;
      if (tag.changed && typeof tag.changed === 'number' && tag.changed > 0) {
        try {
          const date = new Date(tag.changed * 1000);
          if (!isNaN(date.getTime())) {
            changedDate = date.toISOString();
          }
        } catch (error) {
          console.warn(`Неверная дата changed для тега ${tag.id}:`, tag.changed);
        }
      }

      return {
        id: tag.id,
        user_id: tag.user,
        title: tag.title,
        parent_id: tag.parent || null,
        color: tag.color || null,
        icon: tag.icon || null,
        picture: tag.picture || null,
        show_income: tag.showIncome === true,
        show_outcome: tag.showOutcome !== false,
        budget_income: tag.budgetIncome === true,
        budget_outcome: tag.budgetOutcome === true,
        required: tag.required === true,
        archive: tag.archive === true,
        static_id: tag.staticId || null,
        changed: changedDate
      };
    });
    
    // Вставляем теги в Supabase
    const insertResult = await supabaseClient.insertTags(tagsForSupabase);
    if (!insertResult.success) {
      await bot.editMessageText(`❌ Ошибка при загрузке тегов: ${insertResult.error}`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
      return;
    }
    
    // Успешное завершение
    await bot.editMessageText(`✅ Теги успешно обновлены в Supabase!\n\n📊 Загружено: ${tagsForSupabase.length} тегов`, {
      chat_id: chatId,
      message_id: loadingMessage.message_id
    });
    
    console.log(`Теги обновлены в Supabase пользователем ${userName} (${tagsForSupabase.length} тегов)`);
    
  } catch (error) {
    console.error('Ошибка при обновлении тегов:', error);
    
    // Проверяем, что loadingMessage существует перед попыткой редактирования
    if (loadingMessage) {
      try {
        await bot.editMessageText('❌ Ошибка при обновлении тегов. Проверьте настройки и попробуйте позже.', {
          chat_id: chatId,
          message_id: loadingMessage.message_id
        });
      } catch (editError) {
        console.error('Ошибка при редактировании сообщения:', editError);
        // Если не удалось отредактировать, отправляем новое сообщение
        bot.sendMessage(chatId, '❌ Ошибка при обновлении тегов. Проверьте настройки и попробуйте позже.');
      }
    } else {
      // Если loadingMessage не определена, отправляем новое сообщение
      bot.sendMessage(chatId, '❌ Ошибка при обновлении тегов. Проверьте настройки и попробуйте позже.');
    }
  }
}

// Обработчик команды /ai_settings
async function handleAISettingsCommand(chatId, userName) {
  try {
    if (!supabaseClient) {
      bot.sendMessage(chatId, '❌ Supabase не настроен. Проверьте переменные SB_PROJECT_ID и SB_TOKEN.');
      return;
    }

    const settingsResult = await supabaseClient.getActiveAISettings();
    
    if (!settingsResult.success || !settingsResult.data) {
      bot.sendMessage(chatId, `🤖 **Настройки ИИ не найдены**

❌ Активная конфигурация ИИ не настроена.

💡 Для настройки ИИ обратитесь к администратору.`);
      return;
    }

    const aiSettings = settingsResult.data;
    const status = aiSettings.is_active ? '✅ Активна' : '❌ Неактивна';
    
    const message = `🤖 **Текущие настройки ИИ:**

🔧 **Провайдер:** ${aiSettings.provider || 'Не указан'}
🤖 **Модель:** ${aiSettings.model || 'Не указана'}
🔑 **API ключ:** ${aiSettings.api_key ? '✅ Настроен' : '❌ Не настроен'}
📊 **Макс. токенов:** ${aiSettings.max_tokens || 'Не указано'}
🌡️ **Температура:** ${aiSettings.temperature || 'Не указана'}
⏱️ **Таймаут:** ${aiSettings.timeout || 'Не указан'} сек
📝 **Описание:** ${aiSettings.description || 'Нет описания'}
📅 **Обновлено:** ${aiSettings.updated_at ? new Date(aiSettings.updated_at).toLocaleString('ru-RU') : 'Неизвестно'}

**Статус:** ${status}`;

    bot.sendMessage(chatId, message)
      .then(() => {
        console.log(`Отправлены настройки ИИ пользователю ${userName}`);
      })
      .catch((error) => {
        console.error('Ошибка при отправке настроек ИИ:', error);
      });

  } catch (error) {
    console.error('Ошибка при получении настроек ИИ:', error);
    bot.sendMessage(chatId, '❌ Ошибка при получении настроек ИИ. Попробуйте позже.');
  }
}

// Обработчик команды /ai_test
async function handleAITestCommand(chatId, userName) {
  try {
    if (!supabaseClient) {
      bot.sendMessage(chatId, '❌ Supabase не настроен. Проверьте переменные SB_PROJECT_ID и SB_TOKEN.');
      return;
    }

    const loadingMessage = await bot.sendMessage(chatId, '🧪 Тестируем ИИ-функционал...');

    // Импортируем функцию тестирования
    const { testAIFunctionality } = require('./src/ai/analyzer');
    
    const testResult = await testAIFunctionality(supabaseClient);
    
    if (testResult.success) {
      const message = `✅ **Тест ИИ прошел успешно!**

${testResult.message}

🧪 **Результат тестового анализа:**
${testResult.testAnalysis.success ? 
  `🎯 Найдено тегов: ${testResult.testAnalysis.tags?.length || 0}
📊 Уверенность: ${Math.round((testResult.testAnalysis.confidence || 0) * 100)}%
${testResult.testAnalysis.tags?.length > 0 ? 
  `🏆 Основной: ${testResult.testAnalysis.primaryTag?.title || 'Не найден'}` : 
  '❌ Теги не найдены'
}` : 
  `❌ Ошибка: ${testResult.testAnalysis.error}`
}`;

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
    } else {
      bot.editMessageText(`❌ **Тест ИИ не прошел**

Ошибка: ${testResult.error}

💡 Проверьте настройки ИИ командой /ai_settings`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id
      });
    }

  } catch (error) {
    console.error('Ошибка при тестировании ИИ:', error);
    bot.sendMessage(chatId, '❌ Ошибка при тестировании ИИ. Попробуйте позже.');
  }
}

// Функция создания структуры транзакции
function createTransactionStructure(comment, accountName = 'Бумажник') {
  return `Новая запись:

🛍️ Продукты
👛 ${accountName}
💲 500 000 UZS
💬 ${comment}`;
}

// Функция создания инлайн клавиатуры
function createTransactionKeyboard() {
  return [
    [
      {
        text: '💳',
        callback_data: 'transaction_card'
      },
      {
        text: '💵',
        callback_data: 'transaction_cash'
      },
      {
        text: '✅',
        callback_data: 'transaction_apply'
      },
      {
        text: '❌', 
        callback_data: 'transaction_cancel'
      },
      {
        text: '✏️',
        callback_data: 'transaction_edit'
      }
    ]
  ];
}

// Обработчик callback query
async function handleCallbackQuery(callbackQuery) {
  const chatId = callbackQuery.message.chat.id;
  const messageId = callbackQuery.message.message_id;
  const data = callbackQuery.data;
  const user = callbackQuery.from;
  const userName = user.first_name || user.username || 'Неизвестный пользователь';
  
  // Отвечаем на callback query
  bot.answerCallbackQuery(callbackQuery.id)
    .then(() => {
      console.log(`Обработан callback от пользователя ${userName}: ${data}`);
    })
    .catch((error) => {
      console.error('Ошибка при ответе на callback query:', error);
    });
  
  // Обработка различных действий
  switch (data) {
    case 'transaction_apply':
      await handleTransactionApply(chatId, messageId, callbackQuery.message.text);
      break;
      
    case 'transaction_cancel':
      await handleTransactionCancel(chatId, messageId, callbackQuery.message.text);
      break;
      
    case 'transaction_edit':
      await handleTransactionEdit(chatId, messageId);
      break;
      
    case 'transaction_card':
      await handleAccountSelection(chatId, messageId, 'default_card', callbackQuery.message.text);
      break;
      
    case 'transaction_cash':
      await handleAccountSelection(chatId, messageId, 'default_cash', callbackQuery.message.text);
      break;
      
    default:
      // Обработка callback для ИИ тегов
      if (data.startsWith('ai_tag_')) {
        const tagId = data.replace('ai_tag_', '');
        await handleAITagSelection(chatId, messageId, tagId, callbackQuery.message.text);
      } else {
        console.log(`Неизвестный callback data: ${data}`);
      }
  }
}

// Функция обработки выбора тега ИИ
async function handleAITagSelection(chatId, messageId, tagId, originalMessage) {
  try {
    if (!supabaseClient) {
      bot.sendMessage(chatId, '❌ Ошибка: Supabase не настроен.');
      return;
    }

    // Получаем информацию о выбранном теге
    const tagsResult = await supabaseClient.getAllTagsWithParents();
    if (!tagsResult.success || !tagsResult.data) {
      bot.sendMessage(chatId, '❌ Ошибка при получении информации о теге.');
      return;
    }

    const selectedTag = tagsResult.data.find(tag => tag.id === tagId);
    if (!selectedTag) {
      bot.sendMessage(chatId, '❌ Тег не найден.');
      return;
    }

    // Формируем сообщение с подтверждением выбора
    const confirmationMessage = `✅ **Выбран тег:** ${selectedTag.title}
    
${selectedTag.parent_title ? `📂 **Категория:** ${selectedTag.parent_title}` : ''}
${selectedTag.description ? `📝 **Описание:** ${selectedTag.description}` : ''}

🎯 Тег успешно применен к транзакции!`;

    // Обновляем сообщение с результатом
    bot.editMessageText(confirmationMessage, {
      chat_id: chatId,
      message_id: messageId
    });

    console.log(`✅ Пользователь выбрал тег ИИ: ${selectedTag.title} (ID: ${tagId})`);

  } catch (error) {
    console.error('❌ Ошибка при обработке выбора тега ИИ:', error.message);
    bot.sendMessage(chatId, '❌ Ошибка при обработке выбора тега.');
  }
}

// Функция обработки применения транзакции
async function handleTransactionApply(chatId, messageId, originalMessage) {
  try {
    // Извлекаем структуру записи из оригинального сообщения
    const structureMatch = originalMessage.match(/Новая запись:(.+)/s);
    const structure = structureMatch ? structureMatch[1].trim() : originalMessage;
    
    // Формируем новое сообщение
    const newMessage = `✅ Запись добавлена

${structure}`;
    
    // Обновляем сообщение без кнопок
    bot.editMessageText(newMessage, {
      chat_id: chatId,
      message_id: messageId
    });
    
  } catch (error) {
    console.error('Ошибка при применении транзакции:', error);
  }
}

// Функция экранирования для MarkdownV2
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Функция обработки отмены транзакции
async function handleTransactionCancel(chatId, messageId, originalMessage) {
  try {
    // Извлекаем структуру записи из оригинального сообщения
    const structureMatch = originalMessage.match(/Новая запись:(.+)/s);
    const structure = structureMatch ? structureMatch[1].trim() : originalMessage;
    
    // Добавляем зачеркивание ко всем строкам структуры и экранируем
    const strikethroughStructure = structure.split('\n').map(line => 
      line.trim() ? `~~${escapeMarkdownV2(line.trim())}~~` : line
    ).join('\n');
    
    // Формируем новое сообщение
    const newMessage = `❌ Запись отменена

${strikethroughStructure}`;
    
    // Обновляем сообщение без кнопок
    bot.editMessageText(newMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2'
    });
    
  } catch (error) {
    console.error('Ошибка при отмене транзакции:', error);
  }
}

// Функция обработки корректировки транзакции
async function handleTransactionEdit(chatId, messageId) {
  try {
    // Удаляем сообщение
    bot.deleteMessage(chatId, messageId);
    
  } catch (error) {
    console.error('Ошибка при удалении сообщения:', error);
  }
}

// Функция обработки выбора счета
async function handleAccountSelection(chatId, messageId, settingName, originalMessage) {
  try {
    if (!supabaseClient) {
      bot.editMessageText('❌ Supabase не настроен', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }
    
    // Получаем значение настройки из Supabase
    const settingResult = await supabaseClient.getSetting(settingName);
    const accountName = settingResult.success && settingResult.value ? settingResult.value : 'Бумажник';
    
    // Извлекаем комментарий из оригинального сообщения
    const commentMatch = originalMessage.match(/💬 \*\*Комментарий:\*\* (.+)/);
    const comment = commentMatch ? commentMatch[1] : 'Комментарий не найден';
    
    // Создаем новую структуру транзакции с выбранным счетом
    const newTransactionStructure = createTransactionStructure(comment, accountName);
    const inlineKeyboard = createTransactionKeyboard();
    
    bot.editMessageText(newTransactionStructure, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: inlineKeyboard
      }
    });
    
  } catch (error) {
    console.error('Ошибка при обработке выбора счета:', error);
    bot.editMessageText('❌ Ошибка при выборе счета', {
      chat_id: chatId,
      message_id: messageId
    });
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
