/**
 * Функция для безопасного преобразования ZenMoney ID в UUID
 */
function zenMoneyIdToUuid(zenMoneyId, userId = null) {
  try {
    // Если ID уже в формате UUID, возвращаем как есть
    if (zenMoneyId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return zenMoneyId;
    }
    
    // Для числовых ID создаем детерминистический UUID с учетом userId
    // Используем MD5 хеш от строки с префиксом и userId для уникальности
    const crypto = require('crypto');
    const seedString = userId ? `zm-${zenMoneyId}-user-${userId}` : `zm-${zenMoneyId}`;
    const hash = crypto.createHash('md5').update(seedString).digest('hex');
    
    // Формируем UUID из хеша
    return [
      hash.substring(0, 8),
      hash.substring(8, 12),
      hash.substring(12, 16),
      hash.substring(16, 20),
      hash.substring(20, 32)
    ].join('-');
    
  } catch (error) {
    // Если что-то пошло не так, создаем случайный UUID
    console.error('❌ Ошибка при генерации UUID:', error.message);
    const crypto = require('crypto');
    return crypto.randomUUID();
  }
}

/**
 * Парсит данные транзакции из сообщения
 */
function parseTransactionFromMessage(messageText) {
  try {
    // Регулярные выражения для извлечения данных
    const tagMatch = messageText.match(/🛍️ (.+)/);
    const accountMatch = messageText.match(/👛 (.+)/);
    const amountMatch = messageText.match(/💲 (.+)/);
    const commentMatch = messageText.match(/💬 (.+)/);
    
    if (!tagMatch || !accountMatch || !amountMatch || !commentMatch) {
      return null;
    }
    
    // Извлекаем сумму и конвертируем в число
    const amountStr = amountMatch[1].replace(/\s+/g, '').replace(',', '.');
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount)) {
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
    
    return transactionData;
    
  } catch (error) {
    console.error('❌ Ошибка при парсинге транзакции:', error.message);
    return null;
  }
}

module.exports = {
  zenMoneyIdToUuid,
  parseTransactionFromMessage
};
