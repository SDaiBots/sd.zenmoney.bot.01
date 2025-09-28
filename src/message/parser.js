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
 * Нормализует русские числительные в текст
 * @param {string} text - Исходный текст
 * @returns {string} - Нормализованный текст
 */
function normalizeRussianNumbers(text) {
  try {
    if (!text) return text;
    
    let normalizedText = text.toLowerCase();
    
    // Словарь для замены русских числительных
    const numberReplacements = {
      // Основные числа
      'один': '1', 'одна': '1', 'одно': '1',
      'два': '2', 'две': '2',
      'три': '3', 'четыре': '4', 'пять': '5',
      'шесть': '6', 'семь': '7', 'восемь': '8', 'девять': '9',
      'десять': '10', 'одиннадцать': '11', 'двенадцать': '12',
      'тринадцать': '13', 'четырнадцать': '14', 'пятнадцать': '15',
      'шестнадцать': '16', 'семнадцать': '17', 'восемнадцать': '18', 'девятнадцать': '19',
      'двадцать': '20', 'тридцать': '30', 'сорок': '40', 'пятьдесят': '50',
      'шестьдесят': '60', 'семьдесят': '70', 'восемьдесят': '80', 'девяносто': '90',
      'сто': '100', 'двести': '200', 'триста': '300', 'четыреста': '400', 'пятьсот': '500',
      'шестьсот': '600', 'семьсот': '700', 'восемьсот': '800', 'девятьсот': '900',
      
      // Множители (полные формы)
      'тысяча': '1000', 'тысячи': '1000', 'тысяч': '1000',
      'миллион': '1000000', 'миллиона': '1000000', 'миллионов': '1000000',
      'миллиард': '1000000000', 'миллиарда': '1000000000', 'миллиардов': '1000000000'
    };
    
    // Заменяем числительные на цифры (сначала длинные слова, чтобы избежать частичных замен)
    const sortedReplacements = Object.entries(numberReplacements).sort((a, b) => b[0].length - a[0].length);
    
    for (const [word, replacement] of sortedReplacements) {
      const regex = new RegExp(word, 'gi');
      normalizedText = normalizedText.replace(regex, replacement);
    }
    
    // Обрабатываем составные числа (например: "100 1000" -> "100000")
    // Ищем паттерны типа "число + 1000/1000000/1000000000"
    const compoundPatterns = [
      { pattern: /(\d+)\s*1000000000/g, multiplier: 1000000000 }, // миллиарды
      { pattern: /(\d+)\s*1000000/g, multiplier: 1000000 }, // миллионы  
      { pattern: /(\d+)\s*1000/g, multiplier: 1000 } // тысячи
    ];
    
    for (const { pattern, multiplier } of compoundPatterns) {
      normalizedText = normalizedText.replace(pattern, (match, number) => {
        const num = parseInt(number);
        return (num * multiplier).toString();
      });
    }
    
    return normalizedText;
    
  } catch (error) {
    console.error('❌ Ошибка при нормализации чисел:', error.message);
    return text;
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
    
    // Сначала нормализуем русские числительные
    const normalizedStr = normalizeRussianNumbers(amountStr);
    
    // Убираем пробелы и заменяем запятую на точку
    const cleanStr = normalizedStr.replace(/\s+/g, '').replace(',', '.');
    
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
    
    // Форматируем число с разделителями тысяч БЕЗ валюты
    const formattedAmount = new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
      style: 'decimal'  // Явно указываем, что НЕ нужна валюта
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
  normalizeRussianNumbers,
  detectAccountType,
  getDefaultAccountName,
  formatAmount
};
