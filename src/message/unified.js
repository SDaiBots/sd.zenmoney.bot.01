/**
 * Создание единого сообщения с объединенным форматом транзакции
 */

const { 
  extractAmount, 
  detectAccountType, 
  getDefaultAccountName, 
  formatAmount 
} = require('./parser');

/**
 * Создает единое сообщение с объединенным форматом транзакции
 * @param {string} userMessage - Сообщение пользователя
 * @param {Object} aiResult - Результат ИИ-анализа тегов
 * @param {Object} settings - Настройки из Supabase
 * @param {Object} supabaseClient - Клиент Supabase для получения информации о счетах
 * @returns {Object} - Объект с текстом сообщения и данными транзакции
 */
async function createUnifiedTransactionMessage(userMessage, aiResult, settings = {}, supabaseClient = null) {
  try {
    console.log('📝 Создаем единое сообщение транзакции...');
    
    // 1. Извлекаем сумму из сообщения
    const amountData = extractAmount(userMessage);
    console.log(`💰 Извлечены данные о сумме:`, amountData);
    
    // 2. Определяем тип счета
    const accountType = detectAccountType(userMessage);
    console.log(`🏦 Определен тип счета: ${accountType}`);
    
    // 3. Получаем название счета по умолчанию
    const accountName = getDefaultAccountName(accountType, settings);
    console.log(`📋 Название счета: ${accountName}`);
    
    // 4. Определяем сумму
    let amount = amountData.amount;
    if (!amount) {
      amount = 0; // Если сумма не найдена, ставим 0
      console.log(`⚠️ Сумма не найдена, используем 0`);
    }
    
    // 5. Определяем тег
    let tag = 'Продукты'; // По умолчанию
    let additionalTags = [];
    
    if (aiResult && aiResult.success && aiResult.tags && aiResult.tags.length > 0) {
      tag = aiResult.tags[0].title; // Основной тег
      if (aiResult.tags.length > 1) {
        additionalTags = aiResult.tags.slice(1); // Дополнительные теги для кнопок
      }
      console.log(`🏷️ Основной тег: ${tag}, дополнительных: ${additionalTags.length}`);
    }
    
    // 6. Получаем сегодняшнюю дату
    const today = new Date().toLocaleDateString('ru-RU');
    
    // 7. Форматируем сумму
    const formattedAmount = formatAmount(amount);
    
    // 8. Создаем текст сообщения
    const messageText = `Новая запись от ${today}

🛍️ ${tag}
👛 ${accountName}
💲 ${formattedAmount}
💬 ${userMessage}`;
    
    // 9. Создаем объект с данными транзакции
    const transactionData = {
      tag: {
        id: aiResult && aiResult.tags && aiResult.tags.length > 0 ? aiResult.tags[0].id : null,
        title: tag
      },
      account: {
        name: accountName,
        type: accountType
      },
      amount: amount,
      formattedAmount: formattedAmount,
      comment: userMessage,
      date: today,
      additionalTags: additionalTags,
      aiConfidence: aiResult ? aiResult.confidence : 0
    };
    
    console.log('✅ Единое сообщение транзакции создано');
    
    return {
      success: true,
      messageText,
      transactionData,
      hasMultipleTags: additionalTags.length > 0,
      aiTags: aiResult && aiResult.tags ? aiResult.tags : []
    };
    
  } catch (error) {
    console.error('❌ Ошибка при создании единого сообщения транзакции:', error.message);
    return {
      success: false,
      error: error.message,
      messageText: `Ошибка при создании сообщения: ${error.message}`,
      transactionData: null
    };
  }
}

/**
 * Создает инлайн клавиатуру для единого сообщения транзакции
 * @param {Object} transactionData - Данные транзакции
 * @param {boolean} hasMultipleTags - Есть ли дополнительные теги
 * @param {Array} aiTags - Исходные теги от ИИ (для сохранения в кнопках)
 * @returns {Array} - Массив кнопок для инлайн клавиатуры
 */
function createUnifiedTransactionKeyboard(transactionData, hasMultipleTags, aiTags = []) {
  try {
    const keyboard = [];
    
    // Если есть теги от ИИ, добавляем их как инлайн кнопки
    if (aiTags && aiTags.length > 0) {
      const tagButtons = [];
      
      // Создаем кнопки для всех тегов от ИИ (максимум 3 в ряду)
      for (let i = 0; i < Math.min(aiTags.length, 3); i++) {
        const tag = aiTags[i];
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
      {
        text: '💳',
        callback_data: 'unified_account_card'
      },
      {
        text: '💵',
        callback_data: 'unified_account_cash'
      },
      {
        text: '✅',
        callback_data: 'unified_apply'
      },
      {
        text: '❌',
        callback_data: 'unified_cancel'
      },
      {
        text: '✏️',
        callback_data: 'unified_edit'
      }
    ];
    
    keyboard.push(mainButtons);
    
    return keyboard;
    
  } catch (error) {
    console.error('❌ Ошибка при создании клавиатуры:', error.message);
    return [];
  }
}

/**
 * Обновляет сообщение с новым тегом
 * @param {string} currentMessageText - Текущий текст сообщения
 * @param {string} newTagTitle - Новый тег
 * @returns {string} - Обновленный текст сообщения
 */
function updateMessageWithNewTag(currentMessageText, newTagTitle) {
  try {
    // Заменяем тег в сообщении
    const updatedMessage = currentMessageText.replace(
      /🛍️ .+/,
      `🛍️ ${newTagTitle}`
    );
    
    return updatedMessage;
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении тега в сообщении:', error.message);
    return currentMessageText;
  }
}

/**
 * Обновляет сообщение с новым счетом
 * @param {string} currentMessageText - Текущий текст сообщения
 * @param {string} newAccountName - Новое название счета
 * @returns {string} - Обновленный текст сообщения
 */
function updateMessageWithNewAccount(currentMessageText, newAccountName) {
  try {
    console.log(`🔄 Обновляем счет в сообщении: "${newAccountName}"`);
    console.log(`📝 Исходное сообщение:`, currentMessageText);
    
    // Заменяем счет в сообщении
    const updatedMessage = currentMessageText.replace(
      /👛 .+/,
      `👛 ${newAccountName}`
    );
    
    console.log(`📝 Обновленное сообщение:`, updatedMessage);
    console.log(`✅ Сообщение обновлено: ${updatedMessage !== currentMessageText ? 'ДА' : 'НЕТ'}`);
    
    return updatedMessage;
    
  } catch (error) {
    console.error('❌ Ошибка при обновлении счета в сообщении:', error.message);
    return currentMessageText;
  }
}



module.exports = {
  createUnifiedTransactionMessage,
  createUnifiedTransactionKeyboard,
  updateMessageWithNewTag,
  updateMessageWithNewAccount
};
