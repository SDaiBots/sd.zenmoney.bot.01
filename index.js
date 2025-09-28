const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const SupabaseClient = require('./src/supabase/client');
const { analyzeMessageWithAI } = require('./src/ai/analyzer');
const { createUnifiedTransactionMessage, createUnifiedTransactionKeyboard, updateMessageWithNewTag, updateMessageWithNewAccount } = require('./src/message/unified');
const { createZenMoneyTransactionStructure, createTransactionInZenMoney, formatTransactionForDisplay } = require('./src/zenmoney/transaction');
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

// Функция скачивания голосового файла из Telegram
async function downloadVoiceFile(fileId) {
  try {
    console.log(`📥 Скачиваем голосовой файл: ${fileId}`);
    
    // Получаем информацию о файле
    const fileInfo = await bot.getFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('Не удалось получить информацию о файле');
    }
    
    // Формируем URL для скачивания
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    
    // Скачиваем файл
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    console.log(`✅ Файл успешно скачан, размер: ${response.data.length} байт`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Ошибка при скачивании голосового файла:', error.message);
    throw error;
  }
}

// Функция транскрибации голосового сообщения через OpenAI Whisper
async function transcribeVoice(audioBuffer) {
  try {
    console.log('🎤 Начинаем транскрибацию голосового сообщения...');
    
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Создаем File объект для OpenAI API
    const audioFile = new File([audioBuffer], 'voice.ogg', {
      type: 'audio/ogg'
    });
    
    // Отправляем запрос к Whisper API
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ru', // Указываем русский язык для лучшего распознавания
      prompt: 'Транзакция расход доход сумма магазин продукты. Числа всегда пиши цифрами с пробелами: сто тысяч = 100 000, два миллиона = 2 000 000, тысяча сто = 1 100, пятьсот = 500, тысяча = 1 000, двадцать тысяч = 20 000'
    });
    
    const transcribedText = response.text.trim();
    console.log(`✅ Транскрибация завершена: "${transcribedText}"`);
    
    return transcribedText;
    
  } catch (error) {
    console.error('❌ Ошибка при транскрибации:', error.message);
    throw error;
  }
}

// Функция обработки голосового сообщения
async function handleVoiceMessage(chatId, voice, user, fullUserName) {
  try {
    console.log(`🎤 Получено голосовое сообщение от пользователя ${fullUserName}`);
    
    // Отправляем сообщение о начале обработки
    const processingMessage = await bot.sendMessage(chatId, '🎤 Обрабатываю голосовое сообщение...');
    
    // Скачиваем аудиофайл
    const audioBuffer = await downloadVoiceFile(voice.file_id);
    
    // Транскрибируем голос
    const transcribedText = await transcribeVoice(audioBuffer);
    
    // Удаляем сообщение о обработке
    await bot.deleteMessage(chatId, processingMessage.message_id);
    
    if (!transcribedText || transcribedText.trim() === '') {
      await bot.sendMessage(chatId, '❌ Не удалось распознать речь в голосовом сообщении. Попробуйте еще раз.');
      return;
    }
    
    // Отправляем сообщение с результатом транскрибации
    await bot.sendMessage(chatId, `🎤 *Распознанный текст:*\n"${transcribedText}"`, { parse_mode: 'Markdown' });
    
    // Обрабатываем транскрибированный текст как голосовое сообщение
    await handleTransactionWithAI(chatId, transcribedText, user, fullUserName, true);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке голосового сообщения:', error.message);
    
    // Отправляем сообщение об ошибке
    let errorMessage = '❌ Ошибка при обработке голосового сообщения.';
    
    if (error.message.includes('timeout')) {
      errorMessage = '⏱️ Время обработки голосового сообщения истекло. Попробуйте отправить более короткое сообщение.';
    } else if (error.message.includes('API key')) {
      errorMessage = '🔑 Ошибка API ключа OpenAI. Обратитесь к администратору.';
    } else if (error.message.includes('file')) {
      errorMessage = '📁 Ошибка при скачивании голосового файла. Попробуйте еще раз.';
    }
    
    await bot.sendMessage(chatId, errorMessage);
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
      handleCallbackQuery(update.callback_query);
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Функция проверки разрешенного пользователя
async function isUserAllowed(userId, username) {
  try {
    if (!supabaseClient) {
      console.warn('⚠️ Supabase клиент не инициализирован, разрешаем всем пользователям');
      return true;
    }

    // Получаем настройку 'user' из Supabase
    const userSettingResult = await supabaseClient.getSetting('user');
    
    if (!userSettingResult.success || !userSettingResult.value) {
      console.warn('⚠️ Настройка "user" не найдена или пуста, разрешаем всем пользователям');
      return true;
    }

    const allowedUser = userSettingResult.value.trim();
    const currentUserId = userId.toString();
    const currentUsername = username || '';

    // Проверяем по ID пользователя или username
    const isAllowed = currentUserId === allowedUser || currentUsername === allowedUser;
    
    if (!isAllowed) {
      console.log(`🚫 Доступ запрещен для пользователя: ID=${currentUserId}, username=${currentUsername}`);
      console.log(`🔒 Разрешенный пользователь: ${allowedUser}`);
    } else {
      console.log(`✅ Доступ разрешен для пользователя: ID=${currentUserId}, username=${currentUsername}`);
    }

    return isAllowed;

  } catch (error) {
    console.error('❌ Ошибка при проверке пользователя:', error.message);
    // В случае ошибки разрешаем доступ для безопасности
    return true;
  }
}

// Функция обработки сообщений
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
  
  // Проверяем, разрешен ли пользователь
  const isAllowed = await isUserAllowed(user.id, user.username);
  
  if (!isAllowed) {
    console.log(`🚫 Игнорируем сообщение от неразрешенного пользователя: ${fullUserName} (ID: ${user.id})`);
    return;
  }
  
  // Обработка команд
  if (text && text.startsWith('/')) {
    handleCommand(message);
    return;
  }
  
  // Обработка голосовых сообщений
  if (voice) {
    await handleVoiceMessage(chatId, voice, user, fullUserName);
    return;
  }
  
  // Обработка обычных сообщений - показываем структуру транзакции с ИИ-анализом
  if (text) {
    handleTransactionWithAI(chatId, text, user, fullUserName);
  }
}

// Функция обработки транзакции с ИИ-анализом
async function handleTransactionWithAI(chatId, text, user, fullUserName, isVoiceMessage = false) {
  try {
    console.log(`🤖 Начинаем обработку сообщения от пользователя ${fullUserName}: "${text}"`);
    
    // Получаем настройки из Supabase
    let settings = {};
    if (supabaseClient) {
      try {
        const defaultCardResult = await supabaseClient.getSetting('default_card');
        const defaultCashResult = await supabaseClient.getSetting('default_cash');
        
        settings = {
          default_card: (defaultCardResult.success && defaultCardResult.value && defaultCardResult.value.trim() !== '') 
            ? defaultCardResult.value.trim() 
            : 'Карта',
          default_cash: (defaultCashResult.success && defaultCashResult.value && defaultCashResult.value.trim() !== '') 
            ? defaultCashResult.value.trim() 
            : 'Бумажник'
        };
      } catch (settingsError) {
        console.warn('⚠️ Ошибка при получении настроек:', settingsError.message);
      }
    }
    
    // Запускаем ИИ-анализ
    const aiResult = await analyzeMessageWithAI(text, supabaseClient);
    
    // Создаем единое сообщение транзакции
    const unifiedResult = await createUnifiedTransactionMessage(text, aiResult, settings, supabaseClient, isVoiceMessage);
    
    if (!unifiedResult.success) {
      throw new Error(unifiedResult.error);
    }
    
    // Создаем клавиатуру с тегами от ИИ
    const keyboard = createUnifiedTransactionKeyboard(unifiedResult.transactionData, unifiedResult.hasMultipleTags, unifiedResult.aiTags);
    
    // Отправляем единое сообщение
    const message = await bot.sendMessage(chatId, unifiedResult.messageText, {
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    
    console.log(`✅ Отправлено единое сообщение транзакции пользователю ${fullUserName} (ID: ${user.id})`);
    
    // Сохраняем исходные теги от ИИ для этого сообщения
    const messageKey = `${chatId}_${message.message_id}`;
    aiTagsStorage.set(messageKey, unifiedResult.aiTags);
    
    console.log(`💾 Сохранены исходные теги от ИИ для сообщения ${messageKey}:`, unifiedResult.aiTags.map(t => t.title));
    
  } catch (error) {
    console.error('❌ Ошибка при обработке транзакции с ИИ:', error.message);
    
    // Fallback: отправляем простое сообщение об ошибке
    bot.sendMessage(chatId, `❌ Ошибка при обработке сообщения: ${error.message}`)
      .then(() => {
        console.log(`✅ Отправлено сообщение об ошибке пользователю ${fullUserName}`);
      })
      .catch((sendError) => {
        console.error('❌ Ошибка при отправке сообщения об ошибке:', sendError);
      });
  }
}

// Функция отправки ответа ИИ
async function sendAIResponse(chatId, aiResult, originalMessage) {
  try {
    const tags = aiResult.tags || [];
    const primaryTag = aiResult.primaryTag;
    
    if (tags.length === 0) {
      const aiMessage = `🤖 *ИИ не смог определить категорию*

🔧 *Модель:* ${escapeMarkdown(aiResult.aiSettings.provider)} (${escapeMarkdown(aiResult.aiSettings.model)})

💡 Попробуйте более конкретное описание или используйте кнопки в основном сообщении.`;
      
      await bot.sendMessage(chatId, aiMessage, { parse_mode: 'Markdown' });
      console.log('✅ Отправлен ответ ИИ: категория не определена');
      return;
    }
    
    // Формируем сообщение
    let aiMessage;
    if (tags.length === 1) {
      // Один вариант - однозначное сопоставление
      aiMessage = `🤖 *ИИ определил категорию:* ${escapeMarkdown(primaryTag.title)}
      
📊 *Уверенность:* ${Math.round(aiResult.confidence * 100)}%
🔧 *Модель:* ${escapeMarkdown(aiResult.aiSettings.provider)} (${escapeMarkdown(aiResult.aiSettings.model)})

✅ Однозначное сопоставление - других вариантов нет.`;
    } else {
      // Несколько вариантов
      aiMessage = `🤖 *ИИ определил категорию:* ${escapeMarkdown(primaryTag.title)}
      
📊 *Уверенность:* ${Math.round(aiResult.confidence * 100)}%
🔧 *Модель:* ${escapeMarkdown(aiResult.aiSettings.provider)} (${escapeMarkdown(aiResult.aiSettings.model)})

💡 Найдено ${tags.length} вариантов. Выберите подходящий:`;
    }
    
    // Создаем инлайн кнопки с вариантами тегов (максимум 5)
    const inlineKeyboard = createAITagsKeyboard(tags.slice(0, 5));
    
    await bot.sendMessage(chatId, aiMessage, {
      parse_mode: 'Markdown',
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

// Функция экранирования Markdown символов для Telegram
function escapeMarkdown(text) {
  if (!text) return '';
  
  // Экранируем специальные символы Markdown
  return text.toString()
    .replace(/\*/g, '\\*')      // *
    .replace(/_/g, '\\_')      // _
    .replace(/\[/g, '\\[')     // [
    .replace(/\]/g, '\\]')     // ]
    .replace(/\(/g, '\\(')     // (
    .replace(/\)/g, '\\)')     // )
    .replace(/~/g, '\\~')      // ~
    .replace(/`/g, '\\`')      // `
    .replace(/>/g, '\\>')      // >
    .replace(/#/g, '\\#')     // #
    .replace(/\+/g, '\\+')     // +
    .replace(/-/g, '\\-')      // -
    .replace(/=/g, '\\=')      // =
    .replace(/\|/g, '\\|')     // |
    .replace(/\{/g, '\\{')     // {
    .replace(/\}/g, '\\}')     // }
    .replace(/\./g, '\\.')     // .
    .replace(/!/g, '\\!');     // !
}

// Функция экранирования Markdown символов для команд (не экранирует дефисы в командах)
function escapeMarkdownForCommands(text) {
  if (!text) return '';
  
  // Сначала защищаем команды от экранирования дефисов
  const commandPattern = /(\/[a-zA-Z_]+-[a-zA-Z_]+)/g;
  const commands = text.match(commandPattern) || [];
  
  let result = text;
  
  // Временно заменяем команды на плейсхолдеры
  commands.forEach((command, index) => {
    result = result.replace(command, `__COMMAND_${index}__`);
  });
  
  // Экранируем все остальные символы, кроме дефисов
  result = result.toString()
    .replace(/\*/g, '\\*')      // *
    .replace(/_/g, '\\_')      // _
    .replace(/\[/g, '\\[')     // [
    .replace(/\]/g, '\\]')     // ]
    .replace(/\(/g, '\\(')     // (
    .replace(/\)/g, '\\)')     // )
    .replace(/~/g, '\\~')      // ~
    .replace(/`/g, '\\`')      // `
    .replace(/>/g, '\\>')      // >
    .replace(/#/g, '\\#')     // #
    .replace(/\+/g, '\\+')     // +
    .replace(/=/g, '\\=')      // =
    .replace(/\|/g, '\\|')     // |
    .replace(/\{/g, '\\{')     // {
    .replace(/\}/g, '\\}')     // }
    .replace(/\./g, '\\.')     // .
    .replace(/!/g, '\\!');     // !
  
  // Возвращаем команды на место
  commands.forEach((command, index) => {
    result = result.replace(`__COMMAND_${index}__`, command);
  });
  
  return result;
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
  const welcomeMessage = `Добро пожаловать в ZenMoney Bot, ${escapeMarkdown(userName)}!

💰 *Основной функционал:*
Отправьте любое сообщение, и бот покажет структуру транзакции с ИИ-анализом категории и возможностью применить, отменить или скорректировать.

🤖 *ИИ-функции:*
Бот автоматически анализирует ваши сообщения и предлагает подходящую категорию расхода/дохода.

📋 *Доступные команды:*
/start - приветствие
/accounts - показать все счета из ZenMoney
/accounts\\_upd - обновить счета в Supabase
/tags\\_upd - обновить теги в Supabase
/ai\\_settings - настройки ИИ
/ai\\_test - тестирование ИИ

💡 *Как использовать:*
Просто отправьте сообщение с описанием траты, например: "Купил хлеб в магазине"`;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' })
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
        displayValue = `${value} (${(value / 100).toFixed(2)})`;
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
      bot.sendMessage(chatId, `🤖 *Настройки ИИ не найдены*

❌ Активная конфигурация ИИ не настроена.

💡 Для настройки ИИ обратитесь к администратору.`, { parse_mode: 'Markdown' });
      return;
    }

    const aiSettings = settingsResult.data;
    const status = aiSettings.is_active ? '✅ Активна' : '❌ Неактивна';
    
    const message = `🤖 *Текущие настройки ИИ:*

🔧 *Провайдер:* ${escapeMarkdown(aiSettings.provider || 'Не указан')}
🤖 *Модель:* ${escapeMarkdown(aiSettings.model || 'Не указана')}
🔑 *API ключ:* ${aiSettings.api_key ? '✅ Настроен' : '❌ Не настроен'}
📊 *Макс\\. токенов:* ${aiSettings.max_tokens || 'Не указано'}
🌡️ *Температура:* ${aiSettings.temperature || 'Не указана'}
⏱️ *Таймаут:* ${aiSettings.timeout || 'Не указан'} сек
📝 *Описание:* ${escapeMarkdown(aiSettings.description || 'Нет описания')}
📅 *Обновлено:* ${aiSettings.updated_at ? new Date(aiSettings.updated_at).toLocaleString('ru-RU') : 'Неизвестно'}

*Статус:* ${status}`;

    bot.sendMessage(chatId, message, { parse_mode: 'Markdown' })
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
      const message = `✅ *Тест ИИ прошел успешно\\!*

${escapeMarkdown(testResult.message)}

🧪 *Результат тестового анализа:*
${testResult.testAnalysis.success ? 
  `🎯 Найдено тегов: ${testResult.testAnalysis.tags?.length || 0}
📊 Уверенность: ${Math.round((testResult.testAnalysis.confidence || 0) * 100)}%
${testResult.testAnalysis.tags?.length > 0 ? 
  `🏆 Основной: ${escapeMarkdown(testResult.testAnalysis.primaryTag?.title || 'Не найден')}` : 
  '❌ Теги не найдены'
}` : 
  `❌ Ошибка: ${escapeMarkdown(testResult.testAnalysis.error)}`
}`;

      bot.editMessageText(message, {
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        parse_mode: 'Markdown'
      });
    } else {
      bot.editMessageText(`❌ *Тест ИИ не прошел*

Ошибка: ${escapeMarkdown(testResult.error)}

💡 Проверьте настройки ИИ командой /ai_settings`, {
        chat_id: chatId,
        message_id: loadingMessage.message_id,
        parse_mode: 'Markdown'
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
💲 500 000
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
      
    // Новые обработчики для единого сообщения
    case 'unified_apply':
      await handleUnifiedApply(chatId, messageId, callbackQuery.message.text);
      break;
      
    case 'unified_cancel':
      await handleUnifiedCancel(chatId, messageId, callbackQuery.message.text);
      break;
      
    case 'unified_edit':
      await handleUnifiedEdit(chatId, messageId);
      break;
      
    case 'unified_account_card':
      await handleUnifiedAccountSelection(chatId, messageId, 'default_card', callbackQuery.message.text);
      break;
      
    case 'unified_account_cash':
      await handleUnifiedAccountSelection(chatId, messageId, 'default_cash', callbackQuery.message.text);
      break;
      
    case 'unified_account_shared_card':
      await handleUnifiedAccountSelection(chatId, messageId, 'shared_card', callbackQuery.message.text);
      break;
      
    default:
      // Обработка callback для ИИ тегов (старые)
      if (data.startsWith('ai_tag_')) {
        const tagId = data.replace('ai_tag_', '');
        await handleAITagSelection(chatId, messageId, tagId, callbackQuery.message.text);
      }
      // Обработка callback для тегов в едином сообщении (новые)
      else if (data.startsWith('unified_tag_')) {
        const tagId = data.replace('unified_tag_', '');
        await handleUnifiedTagSelection(chatId, messageId, tagId, callbackQuery.message.text);
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
    const confirmationMessage = `✅ *Выбран тег:* ${escapeMarkdown(selectedTag.title)}
    
${selectedTag.parent_title ? `📂 *Категория:* ${escapeMarkdown(selectedTag.parent_title)}` : ''}
${selectedTag.description ? `📝 *Описание:* ${escapeMarkdown(selectedTag.description)}` : ''}

🎯 Тег успешно применен к транзакции\\!`;

    // Обновляем сообщение с результатом
    bot.editMessageText(confirmationMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
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

// ===== НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ЕДИНОГО СООБЩЕНИЯ =====

/**
 * Парсит данные транзакции из сообщения
 * @param {string} messageText - Текст сообщения
 * @returns {Object|null} - Данные транзакции или null
 */
function parseTransactionFromMessage(messageText) {
  try {
    console.log('🔍 Парсим данные транзакции из сообщения...');
    
    // Регулярные выражения для извлечения данных
    const tagMatch = messageText.match(/🛍️ (.+)/);
    const accountMatch = messageText.match(/👛 (.+)/);
    const amountMatch = messageText.match(/💲 (.+)/);
    const commentMatch = messageText.match(/💬 (.+)/);
    
    if (!tagMatch || !accountMatch || !amountMatch || !commentMatch) {
      console.log('❌ Не удалось извлечь все необходимые данные из сообщения');
      return null;
    }
    
    // Извлекаем сумму и конвертируем в число
    const amountStr = amountMatch[1].replace(/\s+/g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount)) {
      console.log('❌ Не удалось распарсить сумму:', amountMatch[1]);
      return null;
    }
    
    const transactionData = {
      tag: {
        title: tagMatch[1].trim()
      },
      account: {
        name: accountMatch[1].trim()
      },
      amount: amount,
      formattedAmount: amountMatch[1].trim(),
      comment: commentMatch[1].trim()
    };
    
    console.log('✅ Данные транзакции успешно распарсены:', transactionData);
    return transactionData;
    
  } catch (error) {
    console.error('❌ Ошибка при парсинге транзакции:', error.message);
    return null;
  }
}

// Функция обработки применения транзакции в едином сообщении
async function handleUnifiedApply(chatId, messageId, originalMessage) {
  try {
    console.log('🔄 Обрабатываем нажатие кнопки "принять запись"...');
    
    // Парсим данные транзакции из сообщения
    const transactionData = parseTransactionFromMessage(originalMessage);
    if (!transactionData) {
      bot.editMessageText('❌ Ошибка при парсинге данных транзакции', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }
    
    console.log('📊 Распарсенные данные транзакции:', transactionData);
    
    // Создаем транзакцию в ZenMoney
    const createResult = await createTransactionInZenMoney(transactionData, supabaseClient);
    
    if (createResult.success) {
      // Формируем новое сообщение с подтверждением
      const successMessage = `✅ Запись добавлена

${transactionData.tag.title}
${transactionData.account.name}
${transactionData.formattedAmount} ₽
${transactionData.comment}`;
      
      // Обновляем сообщение без кнопок
      bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: messageId
      });
      
      console.log('✅ Транзакция успешно создана в ZenMoney');
      
    } else {
      // Обрабатываем ошибку создания
      const errorMessage = `❌ Ошибка при создании записи в ZenMoney

${createResult.error}

💡 Проверьте настройки подключения к ZenMoney API.`;
      
      bot.editMessageText(errorMessage, {
        chat_id: chatId,
        message_id: messageId
      });
      
      console.error('❌ Ошибка при создании транзакции в ZenMoney:', createResult.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обработке применения транзакции:', error.message);
    bot.editMessageText('❌ Ошибка при обработке транзакции', {
      chat_id: chatId,
      message_id: messageId
    });
  }
}

// Функция обработки отмены транзакции в едином сообщении
async function handleUnifiedCancel(chatId, messageId, originalMessage) {
  try {
    console.log('🔄 Обрабатываем нажатие кнопки "отменить запись"...');
    
    // Парсим данные транзакции из сообщения
    const transactionData = parseTransactionFromMessage(originalMessage);
    if (!transactionData) {
      bot.editMessageText('❌ Ошибка при парсинге данных транзакции', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }
    
    // Добавляем зачеркивание ко всем строкам структуры и экранируем
    const strikethroughStructure = originalMessage.split('\n').map(line => {
      if (!line.trim()) return line;
      
      // Экранируем специальные символы MarkdownV2
      const escapedLine = line.trim()
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/>/g, '\\>')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/-/g, '\\-')
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/!/g, '\\!');
      
      return `~~${escapedLine}~~`;
    }).join('\n');
    
    // Формируем новое сообщение
    const newMessage = `❌ Запись отменена

${strikethroughStructure}`;
    
    // Обновляем сообщение без кнопок
    bot.editMessageText(newMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2'
    });
    
    console.log('❌ Транзакция отменена в едином сообщении');
    
  } catch (error) {
    console.error('Ошибка при отмене транзакции в едином сообщении:', error);
  }
}

// Функция обработки корректировки транзакции в едином сообщении
async function handleUnifiedEdit(chatId, messageId) {
  try {
    // Удаляем сообщение
    bot.deleteMessage(chatId, messageId);
    console.log('✏️ Сообщение удалено для корректировки');
    
  } catch (error) {
    console.error('Ошибка при удалении сообщения для корректировки:', error);
  }
}

// Функция обработки выбора счета в едином сообщении
async function handleUnifiedAccountSelection(chatId, messageId, settingName, originalMessage) {
  try {
    console.log(`🔍 Начинаем обработку выбора счета: ${settingName} для сообщения ${chatId}_${messageId}`);
    
    if (!supabaseClient) {
      console.error('❌ Supabase клиент не инициализирован');
      console.error('❌ Состояние supabaseClient:', supabaseClient);
      bot.editMessageText('❌ Supabase не настроен', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }
    
    // Получаем значение настройки из Supabase
    console.log(`📋 Получаем настройку: ${settingName}`);
    const settingResult = await supabaseClient.getSetting(settingName);
    console.log(`📋 Результат получения настройки:`, settingResult);
    
    let accountName;
    
    if (settingName === 'default_card') {
      // Если настройка найдена и не пустая, используем её, иначе используем значение по умолчанию
      accountName = (settingResult.success && settingResult.value && settingResult.value.trim() !== '') 
        ? settingResult.value.trim() 
        : 'Карта';
    } else if (settingName === 'default_cash') {
      // Если настройка найдена и не пустая, используем её, иначе используем значение по умолчанию
      accountName = (settingResult.success && settingResult.value && settingResult.value.trim() !== '') 
        ? settingResult.value.trim() 
        : 'Бумажник';
    } else if (settingName === 'shared_card') {
      // Если настройка найдена и не пустая, используем её, иначе используем значение по умолчанию
      accountName = (settingResult.success && settingResult.value && settingResult.value.trim() !== '') 
        ? settingResult.value.trim() 
        : 'Общая карта';
    } else {
      accountName = 'Бумажник';
    }
    
    console.log(`🏦 Определено название счета: ${accountName}`);
    
    // Обновляем сообщение с новым счетом
    console.log(`📝 Обновляем сообщение с новым счетом: ${accountName}`);
    const updatedMessage = updateMessageWithNewAccount(originalMessage, accountName);
    console.log(`📝 Результат обновления сообщения:`, updatedMessage);
    
    // Получаем исходные теги от ИИ из хранилища
    const messageKey = `${chatId}_${messageId}`;
    const originalAiTags = aiTagsStorage.get(messageKey) || [];
    
    console.log(`🔍 Получены исходные теги от ИИ для сообщения ${messageKey}:`, originalAiTags.map(t => t.title));
    
    // Используем исходные теги от ИИ, если они есть, иначе получаем из базы данных
    let availableTags = originalAiTags;
    if (availableTags.length === 0) {
      console.log(`📋 Получаем теги из базы данных, так как исходные теги пусты`);
      const tagsResult = await supabaseClient.getAllTagsWithParents();
      console.log(`📋 Результат получения тегов:`, tagsResult);
      availableTags = tagsResult.success && tagsResult.data ? tagsResult.data.filter(tag => tag.parent_id !== null) : [];
    }
    
    const keyboard = [];
    
    // Добавляем кнопки тегов, если есть теги от ИИ
    if (availableTags.length > 0) {
      const tagButtons = [];
      // Берем максимум 3 тега для кнопок
      const tagsForButtons = availableTags.slice(0, 3);
      
      for (const tag of tagsForButtons) {
        tagButtons.push({
          text: tag.title,
          callback_data: `unified_tag_${tag.id}`
        });
      }
      
      if (tagButtons.length > 0) {
        keyboard.push(tagButtons);
      }
    }
    
    // Основные кнопки управления
    const mainButtons = [
      { text: '💳', callback_data: 'unified_account_card' },
      { text: '💵', callback_data: 'unified_account_cash' },
      { text: '🪪', callback_data: 'unified_account_shared_card' },
      { text: '❌', callback_data: 'unified_cancel' },
      { text: '✅', callback_data: 'unified_apply' }
    ];
    
    keyboard.push(mainButtons);
    
    console.log(`⌨️ Создана клавиатура:`, keyboard);
    console.log(`📤 Отправляем обновленное сообщение...`);
    
    bot.editMessageText(updatedMessage, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
    
    console.log(`✅ Счет обновлен в едином сообщении: ${accountName}`);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке выбора счета в едином сообщении:', error);
    console.error('❌ Детали ошибки:', {
      message: error.message,
      stack: error.stack,
      chatId,
      messageId,
      settingName
    });
    bot.editMessageText('❌ Ошибка при выборе счета', {
      chat_id: chatId,
      message_id: messageId
    });
  }
}

// Функция обработки выбора тега в едином сообщении
async function handleUnifiedTagSelection(chatId, messageId, tagId, originalMessage) {
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

    // Обновляем сообщение с новым тегом
    const updatedMessage = updateMessageWithNewTag(originalMessage, selectedTag.title);
    
    // Получаем исходные теги от ИИ из хранилища
    const messageKey = `${chatId}_${messageId}`;
    const originalAiTags = aiTagsStorage.get(messageKey) || [];
    
    console.log(`🔍 Получены исходные теги от ИИ для сообщения ${messageKey}:`, originalAiTags.map(t => t.title));
    
    // Используем исходные теги от ИИ, если они есть, иначе получаем из базы данных
    const availableTags = originalAiTags.length > 0 ? originalAiTags : tagsResult.data.filter(tag => tag.parent_id !== null);
    
    // Создаем клавиатуру с кнопками тегов
    const keyboard = [];
    
    // Добавляем кнопки тегов, если есть теги от ИИ
    if (availableTags.length > 0) {
      const tagButtons = [];
      const tagsForButtons = availableTags.slice(0, 3);
      
      for (const tag of tagsForButtons) {
        tagButtons.push({
          text: tag.title,
          callback_data: `unified_tag_${tag.id}`
        });
      }
      
      if (tagButtons.length > 0) {
        keyboard.push(tagButtons);
      }
    }
    
    // Основные кнопки управления
    const mainButtons = [
      { text: '💳', callback_data: 'unified_account_card' },
      { text: '💵', callback_data: 'unified_account_cash' },
      { text: '🪪', callback_data: 'unified_account_shared_card' },
      { text: '❌', callback_data: 'unified_cancel' },
      { text: '✅', callback_data: 'unified_apply' }
    ];
    
    keyboard.push(mainButtons);

    // Обновляем сообщение с результатом
    bot.editMessageText(updatedMessage, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

    console.log(`✅ Тег обновлен в едином сообщении: ${selectedTag.title} (ID: ${tagId})`);

  } catch (error) {
    console.error('❌ Ошибка при обработке выбора тега в едином сообщении:', error.message);
    bot.sendMessage(chatId, '❌ Ошибка при обработке выбора тега.');
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
