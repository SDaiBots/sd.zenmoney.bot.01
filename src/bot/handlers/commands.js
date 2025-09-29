const { analyzeMessageWithAI } = require('../../ai/analyzer');
const { createUnifiedTransactionMessage, createUnifiedTransactionKeyboard } = require('../../message/unified');
const { escapeMarkdown } = require('../../utils/formatters');

/**
 * Обработчик команды /start
 */
async function handleStartCommand(bot, supabaseClient, chatId, user, messageId) {
  try {
    const userName = user.first_name || user.username || 'Неизвестный пользователь';
    
    // Проверяем авторизацию пользователя
    const authResult = await supabaseClient.isUserAuthorized(user.id, user.username);
    
    if (!authResult.authorized) {
      console.log(`🚫 Пользователь не авторизован: ${userName} (ID: ${user.id})`);
      
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
    
    // Проверяем наличие токена ZenMoney
    if (!currentUser.zenmoney_token) {
      await requestZenMoneyToken(bot, chatId, currentUser, messageId);
      return;
    }
    
    // Проверяем, загружены ли теги и счета
    const tagsResult = await supabaseClient.getUserTags(currentUser.id);
    const accountsResult = await supabaseClient.getUserAccounts(currentUser.id);
    
    const hasTags = tagsResult.success && tagsResult.data && tagsResult.data.length > 0;
    const hasAccounts = accountsResult.success && accountsResult.data && accountsResult.data.length > 0;
    
    if (!hasTags || !hasAccounts) {
      await showSetupOptions(bot, chatId, currentUser, messageId, hasTags, hasAccounts);
      return;
    }
    
    // Показываем приветствие для настроенного пользователя
    await showWelcomeMessage(bot, chatId, currentUser, messageId);
    
  } catch (error) {
    console.error('❌ Ошибка в handleStartCommand:', error.message);
    bot.sendMessage(chatId, '❌ Произошла ошибка при обработке команды /start', {
      reply_to_message_id: messageId
    });
  }
}

/**
 * Функция запроса токена ZenMoney
 */
async function requestZenMoneyToken(bot, chatId, user, messageId) {
  const message = `🔑 Для работы с ботом необходим токен ZenMoney API.

Отправьте ваш токен ZenMoney для настройки бота.

💡 *Как получить токен:*
1. Войдите в ZenMoney
2. Перейдите в Настройки → API
3. Создайте новый токен
4. Скопируйте и отправьте его боту`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_to_message_id: messageId
  });
}

/**
 * Функция показа опций настройки
 */
async function showSetupOptions(bot, chatId, user, messageId, hasTags = false, hasAccounts = false) {
  let message = `✅ Токен успешно сохранен!

Для завершения настройки выполните следующие действия:`;

  if (!user.zm_user_id) {
    message += `\n\n🆔 Получить zm_user_id - получить ID пользователя из ZenMoney`;
  } else {
    message += `\n\n✅ zm_user_id уже получен: ${user.zm_user_id}`;
  }

  if (!hasTags) {
    message += `\n\n📋 Загрузить статьи (теги) - синхронизация категорий`;
  } else {
    message += `\n\n✅ Статьи уже загружены`;
  }

  if (!hasAccounts) {
    message += `\n💳 Загрузить счета - синхронизация счетов`;
  } else {
    message += `\n✅ Счета уже загружены`;
  }

  message += `\n\n➡️ Перейти дальше - пропустить настройку`;

  const keyboard = [];
  
  if (!user.zm_user_id) {
    keyboard.push([{ text: '🆔 Получить zm_user_id', callback_data: `get_zm_user_id_${user.id}` }]);
  }
  
  if (!hasTags) {
    keyboard.push([{ text: '📋 Загрузить статьи', callback_data: `load_tags_${user.id}` }]);
  }
  
  if (!hasAccounts) {
    keyboard.push([{ text: '💳 Загрузить счета', callback_data: `load_accounts_${user.id}` }]);
  }
  
  keyboard.push([{ text: '➡️ Перейти дальше', callback_data: `skip_setup_${user.id}` }]);

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: keyboard
    },
    reply_to_message_id: messageId
  });
}

/**
 * Функция показа приветствия
 */
async function showWelcomeMessage(bot, chatId, user, messageId) {
  const userName = user.first_name || user.username || 'Пользователь';
  
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
  
  await bot.sendMessage(chatId, welcomeMessage, { 
    parse_mode: 'Markdown',
    reply_to_message_id: messageId
  });
}


module.exports = {
  handleStartCommand,
  requestZenMoneyToken,
  showSetupOptions,
  showWelcomeMessage
};
