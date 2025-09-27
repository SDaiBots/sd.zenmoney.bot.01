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
    
    // 3. Получение доступных тегов
    const tagsResult = await supabaseClient.getAllTags();
    if (!tagsResult.success || !tagsResult.data || tagsResult.data.length === 0) {
      console.log('⚠️ Теги не найдены в базе данных');
      return {
        success: false,
        error: 'Теги не найдены',
        tag: null,
        confidence: 0
      };
    }
    
    const availableTags = tagsResult.data;
    console.log(`📊 Найдено ${availableTags.length} доступных тегов`);
    
    // 4. Создание клиента ИИ и анализ сообщения
    const aiClient = new AIClient(aiSettings);
    const analysisResult = await aiClient.analyzeMessage(message, availableTags);
    
    if (!analysisResult.success) {
      console.log('❌ Ошибка при анализе сообщения ИИ:', analysisResult.error);
      return analysisResult;
    }
    
    // 5. Поиск точного совпадения тега
    let matchedTag = null;
    if (analysisResult.tag) {
      matchedTag = findExactTagMatch(analysisResult.tag, availableTags);
    }
    
    console.log(`✅ ИИ анализ завершен. Найденный тег: ${matchedTag?.title || 'Не найден'}`);
    
    return {
      success: true,
      tag: matchedTag,
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
      tag: null,
      confidence: 0
    };
  }
}

/**
 * Поиск точного совпадения тега в списке доступных тегов
 */
function findExactTagMatch(aiTag, availableTags) {
  if (!aiTag) return null;
  
  const cleanAITag = aiTag.trim().toLowerCase();
  
  // Поиск точного совпадения
  let exactMatch = availableTags.find(tag => 
    tag.title.toLowerCase() === cleanAITag
  );
  
  if (exactMatch) return exactMatch;
  
  // Поиск частичного совпадения
  let partialMatch = availableTags.find(tag => 
    tag.title.toLowerCase().includes(cleanAITag) ||
    cleanAITag.includes(tag.title.toLowerCase())
  );
  
  if (partialMatch) return partialMatch;
  
  // Поиск по ключевым словам
  const keywords = cleanAITag.split(/\s+/);
  let keywordMatch = availableTags.find(tag => {
    const tagWords = tag.title.toLowerCase().split(/\s+/);
    return keywords.some(keyword => 
      tagWords.some(tagWord => 
        tagWord.includes(keyword) || keyword.includes(tagWord)
      )
    );
  });
  
  return keywordMatch || null;
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
    
    // Тестируем анализ простого сообщения
    const testMessage = 'купил хлеб в магазине';
    const testTags = [
      { title: 'Продукты', description: 'Покупка продуктов питания' },
      { title: 'Транспорт', description: 'Расходы на транспорт' }
    ];
    
    const analysisResult = await aiClient.analyzeMessage(testMessage, testTags);
    
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
  findExactTagMatch,
  testAIFunctionality
};
