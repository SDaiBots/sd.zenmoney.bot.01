/**
 * Модуль для работы с транзакциями ZenMoney
 */

const ZenMoneyAPI = require('./api');

/**
 * Формирует структуру транзакции для ZenMoney API
 * @param {Object} transactionData - Данные транзакции из сообщения
 * @param {Object} supabaseClient - Клиент Supabase для получения ID счетов и тегов
 * @returns {Object} - Структура транзакции для ZenMoney
 */
async function createZenMoneyTransactionStructure(transactionData, supabaseClient) {
  try {
    console.log('🔄 Формируем структуру транзакции для ZenMoney...');
    console.log('📊 Данные транзакции:', transactionData);

    // Получаем ID счета из Supabase
    let accountId = null;
    if (supabaseClient) {
      const accountsResult = await supabaseClient.getAllAccounts();
      if (accountsResult.success && accountsResult.data) {
        const account = accountsResult.data.find(acc => 
          acc.title.toLowerCase() === transactionData.account.name.toLowerCase()
        );
        if (account) {
          accountId = account.id;
          console.log(`🏦 Найден счет: ${account.title} (ID: ${accountId})`);
        } else {
          console.log(`⚠️ Счет "${transactionData.account.name}" не найден в базе данных`);
        }
      }
    }

    // Получаем ID тега из Supabase
    let tagId = null;
    if (supabaseClient) {
      const tagsResult = await supabaseClient.getAllTagsWithParents();
      if (tagsResult.success && tagsResult.data) {
        const tag = tagsResult.data.find(t => 
          t.title.toLowerCase() === transactionData.tag.title.toLowerCase()
        );
        if (tag) {
          tagId = tag.id;
          console.log(`🏷️ Найден тег: ${tag.title} (ID: ${tagId})`);
        } else {
          console.log(`⚠️ Тег "${transactionData.tag.title}" не найден в базе данных`);
        }
      }
    }

    // Формируем структуру транзакции для ZenMoney API
    const zenMoneyTransaction = {
      id: generateTransactionId(),
      date: new Date().toISOString().split('T')[0], // Текущая дата в формате YYYY-MM-DD
      amount: Math.round(transactionData.amount * 100), // Сумма в копейках
      account: accountId, // ID счета
      tag: tagId, // ID тега
      comment: transactionData.comment, // Комментарий
      created: Math.floor(Date.now() / 1000), // Unix timestamp
      changed: Math.floor(Date.now() / 1000) // Unix timestamp
    };

    console.log('✅ Структура транзакции для ZenMoney сформирована:', zenMoneyTransaction);

    return {
      success: true,
      transaction: zenMoneyTransaction,
      accountId,
      tagId
    };

  } catch (error) {
    console.error('❌ Ошибка при формировании структуры транзакции:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Создает транзакцию в ZenMoney
 * @param {Object} transactionData - Данные транзакции
 * @param {Object} supabaseClient - Клиент Supabase
 * @returns {Object} - Результат создания транзакции
 */
async function createTransactionInZenMoney(transactionData, supabaseClient) {
  try {
    console.log('🔄 Создаем транзакцию в ZenMoney...');

    // Формируем структуру транзакции
    const structureResult = await createZenMoneyTransactionStructure(transactionData, supabaseClient);
    if (!structureResult.success) {
      return {
        success: false,
        error: `Ошибка формирования структуры: ${structureResult.error}`
      };
    }

    // Создаем экземпляр API клиента
    const zenMoneyAPI = new ZenMoneyAPI();

    // Отправляем транзакцию в ZenMoney
    const result = await zenMoneyAPI.createTransaction(structureResult.transaction);

    console.log('✅ Транзакция успешно создана в ZenMoney');

    return {
      success: true,
      transaction: structureResult.transaction,
      zenMoneyResponse: result
    };

  } catch (error) {
    console.error('❌ Ошибка при создании транзакции в ZenMoney:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Генерирует уникальный ID для транзакции
 * @returns {string} - Уникальный ID
 */
function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `transaction_${timestamp}_${random}`;
}

/**
 * Форматирует структуру транзакции для отображения пользователю
 * @param {Object} transactionData - Данные транзакции
 * @returns {string} - Отформатированная строка
 */
function formatTransactionForDisplay(transactionData) {
  try {
    const date = new Date().toLocaleDateString('ru-RU');
    
    return `📋 *Структура записи для ZenMoney:*

📅 **Дата:** ${date}
🏷️ **Категория:** ${transactionData.tag.title}
🏦 **Счет:** ${transactionData.account.name}
💰 **Сумма:** ${transactionData.formattedAmount} ₽
💬 **Комментарий:** ${transactionData.comment}

✅ Готово к созданию в ZenMoney!`;

  } catch (error) {
    console.error('❌ Ошибка при форматировании транзакции:', error.message);
    return 'Ошибка при форматировании транзакции';
  }
}

module.exports = {
  createZenMoneyTransactionStructure,
  createTransactionInZenMoney,
  generateTransactionId,
  formatTransactionForDisplay
};
