const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

class SupabaseClient {
  constructor() {
    const projectId = process.env.SB_PROJECT_ID;
    const token = process.env.SB_TOKEN;
    
    if (!projectId || !token) {
      throw new Error('SB_PROJECT_ID и SB_TOKEN должны быть установлены в переменных окружения');
    }
    
    const supabaseUrl = `https://${projectId}.supabase.co`;
    
    this.client = createClient(supabaseUrl, token);
  }

  /**
   * Получение клиента Supabase
   */
  getClient() {
    return this.client;
  }

  /**
   * Проверка подключения к Supabase
   */
  async testConnection() {
    try {
      console.log('🔄 Проверяем подключение к Supabase...');
      
      const { data, error } = await this.client
        .from('zm_accounts')
        .select('count')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Подключение к Supabase успешно');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Ошибка подключения к Supabase:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Очистка таблицы zm_accounts
   */
  async clearAccounts() {
    try {
      console.log('🔄 Очищаем таблицу zm_accounts...');
      
      const { error } = await this.client
        .from('zm_accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Таблица zm_accounts очищена');
      return { success: true };
      
    } catch (error) {
      console.error('❌ Ошибка при очистке таблицы zm_accounts:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Вставка счетов в таблицу zm_accounts
   */
  async insertAccounts(accounts) {
    try {
      console.log(`🔄 Вставляем ${accounts.length} счетов в Supabase...`);
      
      const { data, error } = await this.client
        .from('zm_accounts')
        .insert(accounts);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ Успешно вставлено ${accounts.length} счетов`);
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Ошибка при вставке счетов:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение всех счетов из таблицы
   */
  async getAllAccounts() {
    try {
      const { data, error } = await this.client
        .from('zm_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Ошибка при получении счетов:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = SupabaseClient;
