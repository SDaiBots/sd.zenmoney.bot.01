const axios = require('axios');

class ZenMoneyAPI {
  constructor() {
    this.baseURL = process.env.ZENMONEY_API_BASE_URL || 'https://api.zenmoney.ru';
    this.accessToken = process.env.ZENMONEY_TOKEN;
    
    if (!this.accessToken) {
      throw new Error('ZENMONEY_TOKEN не установлен в переменных окружения');
    }

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PellaZenMoneyBot/1.0'
      },
      timeout: 30000
    });
  }

  /**
   * Получение всех справочников из ZenMoney
   * Использует метод POST /v8/diff для получения данных
   */
  async getDictionaries() {
    try {
      console.log('🔄 Запрашиваем справочники из ZenMoney...');
      
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const response = await this.client.post('/v8/diff', {
        currentClientTimestamp: currentTimestamp,
        serverTimestamp: 0 // Первый запрос - получаем все данные
      });

      console.log('✅ Справочники получены успешно');
      return this.parseDictionaries(response.data);
      
    } catch (error) {
      console.error('❌ Ошибка при получении справочников:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Парсинг справочников из ответа API
   */
  parseDictionaries(data) {
    const dictionaries = {
      categories: [],
      wallets: [],
      tags: [],
      transactions: [],
      lastServerTimestamp: data.serverTimestamp
    };

    // Обрабатываем категории
    if (data.categories) {
      dictionaries.categories = Object.values(data.categories).map(category => ({
        id: category.id,
        title: category.title,
        parent: category.parent,
        type: category.type, // 'income' или 'outcome'
        isSystem: category.isSystem || false
      }));
    }

    // Обрабатываем кошельки/счета
    if (data.accounts) {
      dictionaries.wallets = Object.values(data.accounts).map(account => ({
        id: account.id,
        title: account.title,
        type: account.type,
        currency: account.currency,
        balance: account.balance,
        isArchived: account.isArchived || false
      }));
    }

    // Обрабатываем теги
    if (data.tags) {
      dictionaries.tags = Object.values(data.tags).map(tag => ({
        id: tag.id,
        title: tag.title,
        color: tag.color
      }));
    }

    // Обрабатываем транзакции (для справки)
    if (data.transactions) {
      dictionaries.transactions = Object.values(data.transactions).map(transaction => ({
        id: transaction.id,
        date: transaction.date,
        amount: transaction.amount,
        category: transaction.category,
        account: transaction.account,
        comment: transaction.comment
      }));
    }

    return dictionaries;
  }

  /**
   * Получение только категорий
   */
  async getCategories() {
    const dictionaries = await this.getDictionaries();
    return dictionaries.categories;
  }

  /**
   * Получение только кошельков
   */
  async getWallets() {
    const dictionaries = await this.getDictionaries();
    return dictionaries.wallets;
  }

  /**
   * Получение только тегов
   */
  async getTags() {
    const dictionaries = await this.getDictionaries();
    return dictionaries.tags;
  }

  /**
   * Создание транзакции
   */
  async createTransaction(transactionData) {
    try {
      console.log('🔄 Создаем транзакцию в ZenMoney...');
      
      const currentTimestamp = Math.floor(Date.now() / 1000);
      
      const response = await this.client.post('/v8/diff', {
        currentClientTimestamp: currentTimestamp,
        serverTimestamp: 0,
        transactions: [transactionData]
      });

      console.log('✅ Транзакция создана успешно');
      return response.data;
      
    } catch (error) {
      console.error('❌ Ошибка при создании транзакции:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Проверка подключения к API
   */
  async testConnection() {
    try {
      console.log('🔄 Проверяем подключение к ZenMoney API...');
      
      const dictionaries = await this.getDictionaries();
      
      console.log('✅ Подключение к ZenMoney API успешно');
      console.log(`📊 Получено: ${dictionaries.categories.length} категорий, ${dictionaries.wallets.length} кошельков, ${dictionaries.tags.length} тегов`);
      
      return {
        success: true,
        categories: dictionaries.categories.length,
        wallets: dictionaries.wallets.length,
        tags: dictionaries.tags.length,
        lastServerTimestamp: dictionaries.lastServerTimestamp
      };
      
    } catch (error) {
      console.error('❌ Ошибка подключения к ZenMoney API:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ZenMoneyAPI;
