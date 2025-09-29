const ZenMoneyAPI = require('./src/zenmoney/api');

// Устанавливаем токен для тестирования
process.env.ZENMONEY_ACCESS_TOKEN = 'a6HglGKdJqgEBHDEzWLB8rHvH6wlqd';
process.env.ZENMONEY_API_BASE_URL = 'https://api.zenmoney.ru';

async function testZenMoneyAPI() {
  try {
    console.log('🚀 Тестируем ZenMoney API...\n');
    
    const api = new ZenMoneyAPI();
    
    // Тестируем подключение
    const connectionTest = await api.testConnection();
    
    if (!connectionTest.success) {
      console.error('❌ Не удалось подключиться к ZenMoney API');
      console.error('Ошибка:', connectionTest.error);
      return;
    }
    
    console.log('✅ Подключение успешно!\n');
    
    // Получаем все справочники
    console.log('📊 Получаем справочники...\n');
    const dictionaries = await api.getDictionaries();
    
    // Выводим категории
    console.log('📂 КАТЕГОРИИ:');
    console.log('='.repeat(50));
    if (dictionaries.categories.length > 0) {
      dictionaries.categories.forEach((category, index) => {
        console.log(`${index + 1}. ${category.title} (${category.type}) [ID: ${category.id}]`);
      });
    } else {
      console.log('Категории не найдены');
    }
    
    console.log('\n💰 КОШЕЛЬКИ:');
    console.log('='.repeat(50));
    if (dictionaries.wallets.length > 0) {
      dictionaries.wallets.forEach((wallet, index) => {
        console.log(`${index + 1}. ${wallet.title} (${wallet.currency}) [ID: ${wallet.id}]`);
        console.log(`   Баланс: ${wallet.balance}`);
      });
    } else {
      console.log('Кошельки не найдены');
    }
    
    console.log('\n🏷️  ТЕГИ:');
    console.log('='.repeat(50));
    if (dictionaries.tags.length > 0) {
      dictionaries.tags.forEach((tag, index) => {
        console.log(`${index + 1}. ${tag.title} [ID: ${tag.id}]`);
      });
    } else {
      console.log('Теги не найдены');
    }
    
    console.log('\n📈 СТАТИСТИКА:');
    console.log('='.repeat(50));
    console.log(`Категорий: ${dictionaries.categories.length}`);
    console.log(`Кошельков: ${dictionaries.wallets.length}`);
    console.log(`Тегов: ${dictionaries.tags.length}`);
    console.log(`Транзакций: ${dictionaries.transactions.length}`);
    console.log(`Последнее обновление: ${new Date(dictionaries.lastServerTimestamp * 1000).toLocaleString()}`);
    
    // Сохраняем справочники в файл
    const fs = require('fs');
    const dictionariesJson = JSON.stringify(dictionaries, null, 2);
    fs.writeFileSync('zenmoney_dictionaries.json', dictionariesJson);
    console.log('\n💾 Справочники сохранены в файл: zenmoney_dictionaries.json');
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании ZenMoney API:', error.message);
    if (error.response) {
      console.error('Статус:', error.response.status);
      console.error('Данные:', error.response.data);
    }
  }
}

// Запускаем тест
testZenMoneyAPI();
