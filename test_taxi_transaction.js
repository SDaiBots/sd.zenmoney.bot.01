/**
 * Тест создания записи в ZenMoney для сообщения "такси 100 000 карта"
 */

const { createZenMoneyTransactionStructure, createTransactionInZenMoney, formatTransactionForDisplay } = require('./src/zenmoney/transaction');
const SupabaseClient = require('./src/supabase/client');
require('dotenv').config();

async function testTaxiTransaction() {
  try {
    console.log('🚕 Тестируем создание записи "такси 100 000 карта" в ZenMoney...\n');
    
    // Проверяем токен
    if (!process.env.ZENMONEY_TOKEN) {
      console.error('❌ Ошибка: ZENMONEY_TOKEN не установлен в переменных окружения');
      console.log('💡 Добавьте ZENMONEY_TOKEN=your_token_here в файл .env');
      return;
    }
    
    console.log('🔑 Токен ZenMoney найден:', process.env.ZENMONEY_TOKEN.substring(0, 10) + '...');
    
    // Инициализируем Supabase клиент
    const supabaseClient = new SupabaseClient();
    
    // Данные транзакции на основе анализа сообщения "такси 100 000 карта"
    const transactionData = {
      tag: {
        title: 'Продукты' // По умолчанию, так как ИИ не анализировал
      },
      account: {
        name: 'Карта', // Определено по ключевому слову "карта"
        type: 'card'
      },
      amount: 100000, // 100 000 рублей
      formattedAmount: '100 000',
      comment: 'такси 100 000 карта'
    };
    
    console.log('📊 Данные транзакции:');
    console.log(JSON.stringify(transactionData, null, 2));
    console.log();
    
    // Формируем структуру транзакции
    console.log('🔄 Формируем структуру транзакции для ZenMoney...');
    const structureResult = await createZenMoneyTransactionStructure(transactionData, supabaseClient);
    
    if (!structureResult.success) {
      console.log('❌ Ошибка при формировании структуры:', structureResult.error);
      return;
    }
    
    console.log('✅ Структура транзакции сформирована:');
    console.log(JSON.stringify(structureResult.transaction, null, 2));
    console.log();
    
    // Форматируем для отображения
    const displayText = formatTransactionForDisplay(transactionData);
    console.log('📝 Форматированный текст для пользователя:');
    console.log(displayText);
    console.log();
    
    // Создаем транзакцию в ZenMoney
    console.log('🔄 Создаем транзакцию в ZenMoney...');
    const createResult = await createTransactionInZenMoney(transactionData, supabaseClient);
    
    if (createResult.success) {
      console.log('✅ Транзакция успешно создана в ZenMoney!');
      console.log('📊 Ответ от ZenMoney:', createResult.zenMoneyResponse);
      console.log();
      console.log('🎉 Проверьте ваш аккаунт ZenMoney - там должна появиться новая транзакция!');
    } else {
      console.log('❌ Ошибка при создании транзакции:', createResult.error);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    console.error('📊 Детали ошибки:', error);
  }
}

testTaxiTransaction();
