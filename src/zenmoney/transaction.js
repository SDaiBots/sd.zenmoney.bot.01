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
        }
      }
    }

    // Формируем структуру транзакции для ZenMoney API
    const zenMoneyTransaction = {
      id: generateTransactionId(),
      user: 1695996, // ID пользователя из ZenMoney
      date: new Date().toISOString().split('T')[0], // Текущая дата в формате YYYY-MM-DD
      amount: Math.round(transactionData.amount), // Сумма в копейках
      account: accountId, // ID счета расхода
      incomeAccount: accountId, // ID счета дохода (для расходов тот же счет)
      outcomeAccount: accountId, // ID счета расхода
      incomeInstrument: 10548, // ID валюты (узбекский сум)
      outcomeInstrument: 10548, // ID валюты расхода (узбекский сум)
      income: 0, // Для расходов всегда 0
      outcome: Math.round(transactionData.amount), // Сумма расхода в копейках
      category: tagId, // ID тега (используем 'category' вместо 'tag')
      tag: [tagId], // ID тега в виде массива
      merchant: null, // ID мерчанта (null для обычных транзакций)
      payee: null, // ID получателя (null для обычных транзакций)
      reminderMarker: null, // ID напоминания (null для обычных транзакций)
      incomeBankID: null, // ID банка дохода (null для обычных транзакций)
      outcomeBankID: null, // ID банка расхода (null для обычных транзакций)
      opIncome: null, // ID операции дохода (null для обычных транзакций)
      opOutcome: null, // ID операции расхода (null для обычных транзакций)
      opIncomeInstrument: null, // ID валюты операции дохода (null для обычных транзакций)
      opOutcomeInstrument: null, // ID валюты операции расхода (null для обычных транзакций)
      latitude: null, // Широта (null для обычных транзакций)
      longitude: null, // Долгота (null для обычных транзакций)
      deleted: false, // Флаг удаления (false для новых транзакций)
      comment: transactionData.comment, // Комментарий
      created: Math.floor(Date.now() / 1000), // Unix timestamp
      changed: Math.floor(Date.now() / 1000) // Unix timestamp
    };


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
 * @returns {string} - Уникальный ID в формате UUID
 */
function generateTransactionId() {
  // Генерируем UUID v4 для совместимости с ZenMoney
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}


module.exports = {
  createZenMoneyTransactionStructure,
  createTransactionInZenMoney,
  generateTransactionId
};
