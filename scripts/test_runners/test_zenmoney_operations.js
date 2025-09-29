/**
 * Тестовый файл для создания операций в ZenMoney
 * 
 * Инструкция по использованию:
 * 1. Установите ваш токен ZenMoney в переменную ZENMONEY_TOKEN в файле .env
 * 2. Запустите: node test_zenmoney_operations.js
 */

const { createZenMoneyTransactionStructure, createTransactionInZenMoney, formatTransactionForDisplay } = require('./src/zenmoney/transaction');
const SupabaseClient = require('./src/supabase/client');
require('dotenv').config();

// Проверяем наличие токена
if (!process.env.ZENMONEY_TOKEN) {
  console.error('❌ Ошибка: ZENMONEY_TOKEN не установлен в переменных окружения');
  console.log('💡 Добавьте ZENMONEY_TOKEN=your_token_here в файл .env');
  process.exit(1);
}

console.log('🔑 Токен ZenMoney найден:', process.env.ZENMONEY_TOKEN.substring(0, 10) + '...');

async function testZenMoneyOperations() {
  try {
    console.log('🧪 Начинаем тестирование операций ZenMoney...\n');
    
    // Инициализируем Supabase клиент
    const supabaseClient = new SupabaseClient();
    
    // Тестовые данные транзакции
    const testTransactions = [
      {
        tag: { title: 'Продукты' },
        account: { name: 'DC KPB UZS 01 VISA' },
        amount: 50000, // 500 рублей
        formattedAmount: '500',
        comment: 'Тестовая покупка продуктов'
      },
      {
        tag: { title: 'Такси' },
        account: { name: 'DC KPB UZS 01 VISA' },
        amount: 100000, // 1000 рублей
        formattedAmount: '1 000',
        comment: 'Тестовая поездка на такси'
      }
    ];
    
    console.log(`📊 Будет создано ${testTransactions.length} тестовых транзакций\n`);
    
    for (let i = 0; i < testTransactions.length; i++) {
      const transactionData = testTransactions[i];
      console.log(`🔄 Тест ${i + 1}/${testTransactions.length}: Создание транзакции`);
      console.log('📋 Данные:', {
        категория: transactionData.tag.title,
        счет: transactionData.account.name,
        сумма: transactionData.formattedAmount + ' ₽',
        комментарий: transactionData.comment
      });
      
      // Формируем структуру транзакции
      console.log('🔄 Формируем структуру транзакции...');
      const structureResult = await createZenMoneyTransactionStructure(transactionData, supabaseClient);
      
      if (!structureResult.success) {
        console.log(`❌ Ошибка при формировании структуры: ${structureResult.error}\n`);
        continue;
      }
      
      console.log('✅ Структура сформирована:', {
        ID: structureResult.transaction.id,
        дата: structureResult.transaction.date,
        сумма: structureResult.transaction.amount + ' копеек',
        счет_ID: structureResult.transaction.account,
        категория_ID: structureResult.transaction.category
      });
      
      // Форматируем для отображения
      const displayText = formatTransactionForDisplay(transactionData);
      console.log('📝 Форматированный текст:');
      console.log(displayText);
      
      // Создаем транзакцию в ZenMoney
      console.log('🔄 Создаем транзакцию в ZenMoney...');
      const createResult = await createTransactionInZenMoney(transactionData, supabaseClient);
      
      if (createResult.success) {
        console.log('✅ Транзакция успешно создана в ZenMoney!');
        console.log('📊 Ответ от ZenMoney:', createResult.zenMoneyResponse);
      } else {
        console.log('❌ Ошибка при создании транзакции:', createResult.error);
      }
      
      console.log('─'.repeat(60));
      
      // Небольшая пауза между транзакциями
      if (i < testTransactions.length - 1) {
        console.log('⏳ Пауза 2 секунды перед следующей транзакцией...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n🎉 Тестирование завершено!');
    console.log('💡 Проверьте ваш аккаунт ZenMoney - там должны появиться тестовые транзакции');
    
  } catch (error) {
    console.error('❌ Критическая ошибка при тестировании:', error.message);
    console.error('📊 Детали ошибки:', error);
  }
}

// Функция для тестирования только структуры (без создания в ZenMoney)
async function testStructureOnly() {
  try {
    console.log('🧪 Тестируем только формирование структуры (без создания в ZenMoney)...\n');
    
    const supabaseClient = new SupabaseClient();
    
    const testTransaction = {
      tag: { title: 'Продукты' },
      account: { name: 'DC KPB UZS 01 VISA' },
      amount: 25000, // 250 рублей
      formattedAmount: '250',
      comment: 'Тест структуры без создания'
    };
    
    console.log('📋 Тестовые данные:', testTransaction);
    
    const structureResult = await createZenMoneyTransactionStructure(testTransaction, supabaseClient);
    
    if (structureResult.success) {
      console.log('✅ Структура транзакции сформирована успешно:');
      console.log(JSON.stringify(structureResult.transaction, null, 2));
      
      const displayText = formatTransactionForDisplay(testTransaction);
      console.log('\n📝 Форматированный текст для пользователя:');
      console.log(displayText);
    } else {
      console.log('❌ Ошибка при формировании структуры:', structureResult.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании структуры:', error.message);
  }
}

// Проверяем аргументы командной строки
const args = process.argv.slice(2);
const testMode = args[0];

if (testMode === 'structure') {
  testStructureOnly();
} else {
  testZenMoneyOperations();
}

console.log('\n💡 Доступные режимы тестирования:');
console.log('  node test_zenmoney_operations.js        - полное тестирование с созданием транзакций');
console.log('  node test_zenmoney_operations.js structure - тестирование только структуры');
