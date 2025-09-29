const { analyzeMessageWithAI } = require('../../ai/analyzer');
const { createUnifiedTransactionMessage, createUnifiedTransactionKeyboard } = require('../../message/unified');

/**
 * Обработка транзакции с ИИ-анализом
 */
async function handleTransactionWithAI(bot, supabaseClient, aiTagsStorage, chatId, text, user, fullUserName, isVoiceMessage = false, replyToMessageId = null, currentUser = null) {
  try {
    // Получаем настройки из Supabase
    let settings = {};
    if (supabaseClient && currentUser) {
      try {
        // Используем пользовательские настройки, если доступны
        const defaultCardResult = await supabaseClient.getUserSetting(currentUser.id, 'default_card');
        const defaultCashResult = await supabaseClient.getUserSetting(currentUser.id, 'default_cash');
        
        settings = {
          default_card: (defaultCardResult.success && defaultCardResult.value && defaultCardResult.value.trim() !== '') 
            ? defaultCardResult.value.trim() 
            : 'Карта',
          default_cash: (defaultCashResult.success && defaultCashResult.value && defaultCashResult.value.trim() !== '') 
            ? defaultCashResult.value.trim() 
            : 'Бумажник'
        };
      } catch (error) {
        console.warn('⚠️ Ошибка при получении пользовательских настроек:', error.message);
        // Fallback на глобальные настройки
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
        } catch (fallbackError) {
          console.warn('⚠️ Ошибка при получении глобальных настроек:', fallbackError.message);
          settings = {
            default_card: 'Карта',
            default_cash: 'Бумажник'
          };
        }
      }
    } else {
      settings = {
        default_card: 'Карта',
        default_cash: 'Бумажник'
      };
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
      },
      reply_to_message_id: replyToMessageId
    });
    
    // Сохраняем исходные теги от ИИ для этого сообщения
    const messageKey = `${chatId}_${message.message_id}`;
    aiTagsStorage.set(messageKey, unifiedResult.aiTags);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке транзакции с ИИ:', error.message);
    
    // Fallback: отправляем простое сообщение об ошибке
    bot.sendMessage(chatId, `❌ Ошибка при обработке сообщения: ${error.message}`, {
      reply_to_message_id: replyToMessageId
    });
  }
}

/**
 * Обработка ввода токена
 */
async function handleTokenInput(bot, supabaseClient, chatId, text, user, messageId) {
  try {
    const token = text.trim();
    
    // Валидируем токен
    const validationResult = await validateZenMoneyToken(token);
    
    if (!validationResult.valid) {
      await bot.sendMessage(chatId, `❌ Токен недействителен или не работает.\n\n${validationResult.error}\n\nПроверьте правильность токена и попробуйте еще раз.`, {
        reply_to_message_id: messageId
      });
      return;
    }
    
    // Обновляем токен пользователя
    const updateResult = await supabaseClient.updateUserZenMoneyToken(user.id, token);
    
    if (!updateResult.success) {
      throw new Error(updateResult.error);
    }
    
    // Показываем опции настройки
    const { showSetupOptions } = require('./commands');
    await showSetupOptions(bot, chatId, updateResult.data, messageId);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке токена:', error.message);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при сохранении токена. Попробуйте еще раз.', {
      reply_to_message_id: messageId
    });
  }
}

/**
 * Функция валидации токена ZenMoney
 */
async function validateZenMoneyToken(token) {
  try {
    if (!token || token.trim() === '') {
      return { valid: false, error: 'Токен не может быть пустым' };
    }

    const axios = require('axios');
    
    // Тестовый запрос к ZenMoney API
    const response = await axios.post('https://api.zenmoney.ru/v8/diff', {
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp: 0
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PellaZenMoneyBot/1.0'
      },
      timeout: 10000
    });
    
    return { valid: true, data: response.data };
  } catch (error) {
    console.error('❌ Ошибка валидации токена:', error.message);
    
    if (error.response?.status === 401) {
      return { valid: false, error: 'Неверный токен' };
    } else if (error.response?.status === 403) {
      return { valid: false, error: 'Токен заблокирован' };
    } else if (error.code === 'ECONNABORTED') {
      return { valid: false, error: 'Таймаут подключения' };
    } else {
      return { valid: false, error: 'Ошибка подключения к ZenMoney API' };
    }
  }
}

module.exports = {
  handleTransactionWithAI,
  handleTokenInput,
  validateZenMoneyToken
};
