// Тест парсера сообщений
const { extractAmountAndCurrency, detectAccountType, formatAmount } = require('./src/message/parser');

// Тестовые сообщения
const testMessages = [
  "Купил продукты на 150 000 с карты",
  "Потратил 500 рублей наличными",
  "Оплатил интернет $50",
  "Снял 1000 UZS с карты",
  "Потратил деньги в магазине"
];

console.log('🧪 Тестируем парсер сообщений...\n');

testMessages.forEach((message, index) => {
  console.log(`Тест ${index + 1}: "${message}"`);
  
  // Тест извлечения суммы и валюты
  const amountData = extractAmountAndCurrency(message);
  console.log(`  💰 Сумма и валюта:`, amountData);
  
  // Тест определения типа счета
  const accountType = detectAccountType(message);
  console.log(`  🏦 Тип счета: ${accountType}`);
  
  // Тест форматирования суммы
  if (amountData.amount && amountData.currency) {
    const formatted = formatAmount(amountData.amount, amountData.currency);
    console.log(`  📊 Форматированная сумма: ${formatted}`);
  }
  
  console.log('');
});

console.log('✅ Тестирование завершено');
