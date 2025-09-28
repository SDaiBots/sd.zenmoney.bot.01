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
      
      const { data, error } = await this.client
        .from('zm_accounts')
        .select('count')
        .limit(1);
      
      if (error) {
        throw error;
      }
      
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
      
      const { error } = await this.client
        .from('zm_accounts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи
      
      if (error) {
        throw error;
      }
      
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
      
      const { data, error } = await this.client
        .from('zm_accounts')
        .insert(accounts);
      
      if (error) {
        throw error;
      }
      
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

  /**
   * Очистка таблицы zm_tags
   */
  async clearTags() {
    try {
      
      const { error } = await this.client
        .from('zm_tags')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Удаляем все записи
      
      if (error) {
        throw error;
      }
      
      return { success: true };
      
    } catch (error) {
      console.error('❌ Ошибка при очистке таблицы zm_tags:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Вставка тегов в таблицу zm_tags
   */
  async insertTags(tags) {
    try {
      
      const { data, error } = await this.client
        .from('zm_tags')
        .insert(tags);
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Ошибка при вставке тегов:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение всех тегов с информацией о родительских тегах
   */
  async getAllTagsWithParents() {
    try {
      const { data, error } = await this.client
        .from('zm_tags')
        .select(`
          *,
          parent_tag:parent_id (
            id,
            title,
            color,
            icon
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      // Преобразуем данные для удобства использования
      const tagsWithParents = data.map(tag => ({
        ...tag,
        parent_title: tag.parent_tag?.title || null,
        parent_color: tag.parent_tag?.color || null,
        parent_icon: tag.parent_tag?.icon || null
      }));
      
      return { success: true, data: tagsWithParents };
      
    } catch (error) {
      console.error('❌ Ошибка при получении тегов с родителями:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение активных настроек ИИ
   */
  async getActiveAISettings() {
    try {
      const { data, error } = await this.client
        .from('ai_settings')
        .select('*')
        .eq('is_active', true)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      return { success: true, data: data || null };
      
    } catch (error) {
      console.error('❌ Ошибка при получении активных настроек ИИ:', error.message);
      return { success: false, error: error.message, data: null };
    }
  }

  /**
   * Обновление настроек ИИ
   */
  async updateAISettings(id, settings) {
    try {
      const { data, error } = await this.client
        .from('ai_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error(`❌ Ошибка при обновлении настроек ИИ с ID ${id}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Активация конфигурации ИИ (деактивирует все остальные)
   */
  async activateAISettings(id) {
    try {
      // Сначала деактивируем все конфигурации
      await this.client
        .from('ai_settings')
        .update({ is_active: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Обновляем все записи
      
      // Затем активируем нужную
      const { data, error } = await this.client
        .from('ai_settings')
        .update({ 
          is_active: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error(`❌ Ошибка при активации настроек ИИ с ID ${id}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Создание новой конфигурации ИИ
   */
  async createAISettings(settings) {
    try {
      const defaultSettings = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        max_tokens: 1000,
        temperature: 0.3,
        timeout: 30,
        is_active: false,
        description: 'Новая конфигурация ИИ',
        ...settings
      };
      
      const { data, error } = await this.client
        .from('ai_settings')
        .insert(defaultSettings)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Ошибка при создании настроек ИИ:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение настройки по имени параметра
   */
  async getSetting(parameterName) {
    try {
      
      const { data, error } = await this.client
        .from('settings')
        .select('parameter_value')
        .eq('parameter_name', parameterName)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      const value = data?.parameter_value || null;
      
      return { 
        success: true, 
        value: value,
        exists: !!data
      };
      
    } catch (error) {
      console.error(`❌ Ошибка при получении настройки ${parameterName}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        value: null,
        exists: false
      };
    }
  }

  /**
   * Обновление настройки
   */
  async updateSetting(parameterName, parameterValue) {
    try {
      
      const { data, error } = await this.client
        .from('settings')
        .upsert({
          parameter_name: parameterName,
          parameter_value: parameterValue,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error(`❌ Ошибка при обновлении настройки ${parameterName}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение всех настроек
   */
  async getAllSettings() {
    try {
      const { data, error } = await this.client
        .from('settings')
        .select('*')
        .order('parameter_name');
      
      if (error) {
        throw error;
      }
      
      return { success: true, data };
      
    } catch (error) {
      console.error('❌ Ошибка при получении всех настроек:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Получение счета по названию
   */
  async getAccountByName(accountName) {
    try {
      
      const { data, error } = await this.client
        .from('zm_accounts')
        .select('*')
        .eq('title', accountName)
        .eq('archive', false)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      
      return { 
        success: true, 
        data: data || null,
        exists: !!data
      };
      
    } catch (error) {
      console.error(`❌ Ошибка при поиске счета ${accountName}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        data: null,
        exists: false
      };
    }
  }

  /**
   * Получение валюты по instrument_id
   * Пока что возвращаем валюту по умолчанию, так как таблицы instruments нет
   */
  async getCurrencyByInstrumentId(instrumentId) {
    try {
      
      // Пока что используем статический маппинг, так как таблицы instruments нет
      const currencyMap = {
        10548: 'RUB',  // Российский рубль
        11519: 'UZS',  // Узбекский сум  
        11902: 'EUR',  // Евро
        11903: 'USD',  // Доллар США (предполагаем)
        11904: 'KZT'   // Казахстанский тенге (предполагаем)
      };
      
      const currency = currencyMap[instrumentId] || 'RUB';
      
      return { 
        success: true, 
        currency: currency
      };
      
    } catch (error) {
      console.error(`❌ Ошибка при получении валюты для instrument_id ${instrumentId}:`, error.message);
      return { 
        success: false, 
        error: error.message,
        currency: 'RUB'
      };
    }
  }
}

module.exports = SupabaseClient;
