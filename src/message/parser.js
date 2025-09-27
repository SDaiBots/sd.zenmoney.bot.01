/**
 * Парсер сообщений пользователя для извлечения финансовой информации
 */

/**
 * Извлекает сумму и валюту из сообщения пользователя
 * @param {string} message - Сообщение пользователя
 * @returns {Object} - Объект с суммой и валютой
 */
function extractAmountAndCurrency(message) {
  try {
    // Паттерны для поиска сумм с валютами
    const patterns = [
      // Паттерн: число + валюта (например: "150 000 UZS", "500 руб", "100$")
      /(\d+(?:\s+\d+)*(?:[.,]\d+)?)\s*([A-Z]{3}|руб|рублей|доллар|долларов|\$|€|₽)/gi,
      // Паттерн: валюта + число (например: "UZS 150 000", "$100")
      /([A-Z]{3}|\$|€|₽|руб|рублей|доллар|долларов)\s*(\d+(?:\s+\d+)*(?:[.,]\d+)?)/gi,
      // Паттерн: только число (без валюты)
      /(\d+(?:\s+\d+)*(?:[.,]\d+)?)/g
    ];

    let amount = null;
    let currency = null;
    let foundPattern = null;

    // Пробуем каждый паттерн
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = [...message.matchAll(pattern)];
      
      if (matches.length > 0) {
        // Берем первое совпадение
        const match = matches[0];
        
        if (i === 0) {
          // Паттерн: число + валюта
          amount = parseAmount(match[1]);
          currency = normalizeCurrency(match[2]);
          foundPattern = 'amount_currency';
        } else if (i === 1) {
          // Паттерн: валюта + число
          currency = normalizeCurrency(match[1]);
          amount = parseAmount(match[2]);
          foundPattern = 'currency_amount';
        } else {
          // Паттерн: только число
          amount = parseAmount(match[1]);
          foundPattern = 'amount_only';
        }
        
        break;
      }
    }

    return {
      amount,
      currency,
      foundPattern,
      success: amount !== null
    };

  } catch (error) {
    console.error('❌ Ошибка при извлечении суммы и валюты:', error.message);
    return {
      amount: null,
      currency: null,
      foundPattern: null,
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
 * Нормализует название валюты
 * @param {string} currencyStr - Строка с валютой
 * @returns {string|null} - Нормализованная валюта или null
 */
function normalizeCurrency(currencyStr) {
  try {
    if (!currencyStr) return null;
    
    const currency = currencyStr.toUpperCase().trim();
    
    // Маппинг различных вариантов валют
    const currencyMap = {
      'РУБ': 'RUB',
      'РУБЛЕЙ': 'RUB',
      'РУБЛЬ': 'RUB',
      '₽': 'RUB',
      'ДОЛЛАР': 'USD',
      'ДОЛЛАРОВ': 'USD',
      '$': 'USD',
      'ЕВРО': 'EUR',
      '€': 'EUR',
      'UZS': 'UZS',
      'СОМ': 'UZS',
      'СОМОВ': 'UZS'
    };
    
    return currencyMap[currency] || currency;
    
  } catch (error) {
    console.error('❌ Ошибка при нормализации валюты:', error.message);
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
 * Получает валюту по умолчанию для счета
 * @param {string} accountName - Название счета
 * @param {Object} settings - Настройки из Supabase
 * @returns {string} - Валюта
 */
function getDefaultCurrencyForAccount(accountName, settings = {}) {
  try {
    // Если в настройках есть валюта по умолчанию, используем её
    if (settings.default_currency) {
      return settings.default_currency;
    }
    
    // Иначе определяем по названию счета
    const lowerAccountName = accountName.toLowerCase();
    
    if (lowerAccountName.includes('uzs') || lowerAccountName.includes('сом')) {
      return 'UZS';
    } else if (lowerAccountName.includes('usd') || lowerAccountName.includes('доллар')) {
      return 'USD';
    } else if (lowerAccountName.includes('eur') || lowerAccountName.includes('евро')) {
      return 'EUR';
    } else {
      return 'RUB'; // По умолчанию рубли
    }
    
  } catch (error) {
    console.error('❌ Ошибка при получении валюты по умолчанию:', error.message);
    return 'RUB';
  }
}

/**
 * Форматирует сумму для отображения
 * @param {number} amount - Сумма
 * @param {string} currency - Валюта
 * @returns {string} - Отформатированная сумма
 */
function formatAmount(amount, currency) {
  try {
    if (amount === null || amount === undefined) {
      return '0';
    }
    
    // Форматируем число с разделителями тысяч
    const formattedAmount = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
    
    return `${formattedAmount} ${currency}`;
    
  } catch (error) {
    console.error('❌ Ошибка при форматировании суммы:', error.message);
    return `${amount} ${currency}`;
  }
}

module.exports = {
  extractAmountAndCurrency,
  parseAmount,
  normalizeCurrency,
  detectAccountType,
  getDefaultAccountName,
  getDefaultCurrencyForAccount,
  formatAmount
};
