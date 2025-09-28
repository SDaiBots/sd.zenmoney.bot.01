const AIClient = require('./client');
const SupabaseClient = require('../supabase/client');

/**
 * Анализ сообщения пользователя с помощью ИИ
 */
async function analyzeMessageWithAI(message, supabaseClient) {
  try {
    console.log('🤖 Начинаем анализ сообщения с помощью ИИ...');
    
    // 1. Получение активных настроек ИИ
    const settingsResult = await supabaseClient.getActiveAISettings();
    if (!settingsResult.success || !settingsResult.data) {
      console.log('⚠️ Активные настройки ИИ не найдены');
      return {
        success: false,
        error: 'Настройки ИИ не настроены',
        tag: null,
        confidence: 0
      };
    }
    
    const aiSettings = settingsResult.data;
    console.log(`📋 Используем настройки ИИ: ${aiSettings.provider} (${aiSettings.model})`);
    
    // 2. Проверка наличия API ключа
    if (!aiSettings.api_key) {
      console.log('⚠️ API ключ не настроен для активной конфигурации ИИ');
      return {
        success: false,
        error: 'API ключ не настроен',
        tag: null,
        confidence: 0
      };
    }
    
    // 3. Получение доступных тегов с информацией о родителях (только дочерние теги)
    const tagsResult = await supabaseClient.getAllTagsWithParents();
    if (!tagsResult.success || !tagsResult.data || tagsResult.data.length === 0) {
      console.log('⚠️ Теги не найдены в базе данных');
      return {
        success: false,
        error: 'Теги не найдены',
        tag: null,
        confidence: 0
      };
    }
    
    // Фильтруем только дочерние теги (с parent_id не null)
    const availableTags = tagsResult.data.filter(tag => tag.parent_id !== null);
    console.log(`📊 Найдено ${availableTags.length} дочерних тегов из ${tagsResult.data.length} общих тегов`);
    
    if (availableTags.length === 0) {
      console.log('⚠️ Дочерние теги не найдены в базе данных');
      return {
        success: false,
        error: 'Дочерние теги не найдены',
        tag: null,
        confidence: 0
      };
    }
    
    // 4. Создание клиента ИИ и анализ сообщения
    const aiClient = new AIClient(aiSettings);
    const analysisResult = await aiClient.analyzeMessage(message, availableTags);
    
    if (!analysisResult.success) {
      console.log('❌ Ошибка при анализе сообщения ИИ:', analysisResult.error);
      return analysisResult;
    }
    
    // 5. Обработка результатов анализа
    const matchedTags = analysisResult.tags || [];
    
    console.log(`✅ ИИ анализ завершен. Найдено тегов: ${matchedTags.length}`);
    if (matchedTags.length > 0) {
      console.log(`🎯 Основной тег: ${matchedTags[0].title}`);
      if (matchedTags.length > 1) {
        console.log(`📋 Дополнительные варианты: ${matchedTags.slice(1).map(t => t.title).join(', ')}`);
      }
    }
    
    return {
      success: true,
      tags: matchedTags,
      primaryTag: matchedTags.length > 0 ? matchedTags[0] : null,
      confidence: analysisResult.confidence,
      rawResponse: analysisResult.rawResponse,
      aiSettings: {
        provider: aiSettings.provider,
        model: aiSettings.model
      }
    };
    
  } catch (error) {
    console.error('❌ Критическая ошибка при анализе сообщения ИИ:', error.message);
    return {
      success: false,
      error: error.message,
      tags: [],
      primaryTag: null,
      confidence: 0
    };
  }
}


/**
 * Тестирование ИИ-функционала
 */
async function testAIFunctionality(supabaseClient) {
  try {
    console.log('🧪 Тестируем ИИ-функционал...');
    
    // Получаем активные настройки
    const settingsResult = await supabaseClient.getActiveAISettings();
    if (!settingsResult.success || !settingsResult.data) {
      return {
        success: false,
        error: 'Активные настройки ИИ не найдены'
      };
    }
    
    const aiSettings = settingsResult.data;
    
    // Создаем клиент и тестируем соединение
    const aiClient = new AIClient(aiSettings);
    const connectionTest = await aiClient.testConnection();
    
    if (!connectionTest.success) {
      return {
        success: false,
        error: `Ошибка соединения с ${aiSettings.provider}: ${connectionTest.error}`
      };
    }
    
    // Получаем реальные дочерние теги с информацией о родителях для тестирования
    const tagsResult = await supabaseClient.getAllTagsWithParents();
    if (!tagsResult.success || !tagsResult.data || tagsResult.data.length === 0) {
      return {
        success: false,
        error: 'Теги не найдены в базе данных для тестирования'
      };
    }
    
    // Фильтруем только дочерние теги (с parent_id не null)
    const availableTags = tagsResult.data.filter(tag => tag.parent_id !== null);
    
    if (availableTags.length === 0) {
      return {
        success: false,
        error: 'Дочерние теги не найдены для тестирования'
      };
    }
    
    // Тестируем анализ простого сообщения
    const testMessage = 'купил хлеб в магазине';
    const analysisResult = await aiClient.analyzeMessage(testMessage, availableTags);
    
    return {
      success: true,
      message: `ИИ-функционал работает корректно. Провайдер: ${aiSettings.provider}, Модель: ${aiSettings.model}`,
      testAnalysis: analysisResult
    };
    
  } catch (error) {
    console.error('❌ Ошибка при тестировании ИИ-функционала:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  analyzeMessageWithAI,
  testAIFunctionality
};
