/**
 * Парсер сообщений пользователя для извлечения финансовой информации
 */

/**
 * Извлекает сумму из сообщения пользователя
 * @param {string} message - Сообщение пользователя
 * @returns {Object} - Объект с суммой
 */
function extractAmount(message) {
  try {
    // Паттерн для поиска чисел
    const pattern = /(\d+(?:\s+\d+)*(?:[.,]\d+)?)/g;
    const matches = [...message.matchAll(pattern)];
    
    if (matches.length > 0) {
      // Берем первое совпадение
      const match = matches[0];
      const amount = parseAmount(match[1]);
      
      return {
        amount,
        success: amount !== null
      };
    }

    return {
      amount: null,
      success: false
    };

  } catch (error) {
    console.error('❌ Ошибка при извлечении суммы:', error.message);
    return {
      amount: null,
      success: false,
      error: error.message
    };
  }
}

/**
 * Парсит строку суммы в число
 * @param {string} amountStr - Строка с суммой
 * @returns {number|null} - Число или null
 */
function parseAmount(amountStr) {
  try {
    if (!amountStr) return null;
    
    // Убираем пробелы и заменяем запятую на точку
    const cleanStr = amountStr.replace(/\s+/g, '').replace(',', '.');
    
    const amount = parseFloat(cleanStr);
    return isNaN(amount) ? null : amount;
    
  } catch (error) {
    console.error('❌ Ошибка при парсинге суммы:', error.message);
    return null;
  }
}


/**
 * Определяет тип счета на основе сообщения пользователя
 * @param {string} message - Сообщение пользователя
 * @returns {string} - Тип счета: 'card', 'cash', 'unknown'
 */
function detectAccountType(message) {
  try {
    const lowerMessage = message.toLowerCase();
    
    // Ключевые слова для карты
    const cardKeywords = [
      'карт', 'карточк', 'пластик', 'банк', 'снял с карт', 
      'списал с карт', 'оплатил карт', 'перевел с карт',
      'с карты', 'на карту', 'картой'
    ];
    
    // Ключевые слова для наличных
    const cashKeywords = [
      'наличн', 'бумажник', 'кошелек', 'деньги', 'купюр',
      'монет', 'в руках', 'физически', 'реальн'
    ];
    
    // Проверяем наличие ключевых слов для карты
    const hasCardKeywords = cardKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Проверяем наличие ключевых слов для наличных
    const hasCashKeywords = cashKeywords.some(keyword => 
      lowerMessage.includes(keyword)
    );
    
    // Определяем тип счета
    if (hasCardKeywords && !hasCashKeywords) {
      return 'card';
    } else if (hasCashKeywords && !hasCardKeywords) {
      return 'cash';
    } else if (hasCardKeywords && hasCashKeywords) {
      // Если есть оба типа ключевых слов, приоритет у карты
      return 'card';
    } else {
      return 'unknown';
    }
    
  } catch (error) {
    console.error('❌ Ошибка при определении типа счета:', error.message);
    return 'unknown';
  }
}

/**
 * Получает название счета по умолчанию на основе типа
 * @param {string} accountType - Тип счета
 * @param {Object} settings - Настройки из Supabase
 * @returns {string} - Название счета
 */
function getDefaultAccountName(accountType, settings = {}) {
  try {
    switch (accountType) {
      case 'card':
        return settings.default_card || 'Карта';
      case 'cash':
        return settings.default_cash || 'Бумажник';
      default:
        return settings.default_cash || 'Бумажник';
    }
  } catch (error) {
    console.error('❌ Ошибка при получении названия счета по умолчанию:', error.message);
    return 'Бумажник';
  }
}


/**
 * Форматирует сумму для отображения
 * @param {number} amount - Сумма
 * @returns {string} - Отформатированная сумма
 */
function formatAmount(amount) {
  try {
    if (amount === null || amount === undefined) {
      return '0';
    }
    
    // Форматируем число с разделителями тысяч
    const formattedAmount = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
    
    return formattedAmount;
    
  } catch (error) {
    console.error('❌ Ошибка при форматировании суммы:', error.message);
    return amount.toString();
  }
}

module.exports = {
  extractAmount,
  parseAmount,
  detectAccountType,
  getDefaultAccountName,
  formatAmount
};
