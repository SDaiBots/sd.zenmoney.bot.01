const OpenAI = require('openai');
const axios = require('axios');

class AIClient {
  constructor(settings) {
    this.provider = settings.provider;
    this.model = settings.model;
    this.apiKey = settings.api_key;
    this.maxTokens = settings.max_tokens || 1000;
    this.temperature = settings.temperature || 0.3;
    this.timeout = settings.timeout || 30;
    
    // Инициализация клиентов в зависимости от провайдера
    if (this.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        timeout: this.timeout * 1000
      });
    }
  }
  
  /**
   * Анализ сообщения пользователя для определения подходящего тега
   */
  async analyzeMessage(message, availableTags) {
    try {
      console.log(`🤖 Анализируем сообщение через ${this.provider} (${this.model})...`);
      
      const prompt = this.generatePrompt(message, availableTags);
      
      let response;
      switch (this.provider) {
        case 'openai':
          response = await this.analyzeWithOpenAI(prompt);
          break;
        case 'perplexity':
          response = await this.analyzeWithPerplexity(prompt);
          break;
        default:
          throw new Error(`Неподдерживаемый провайдер ИИ: ${this.provider}`);
      }
      
      return this.parseResponse(response);
      
    } catch (error) {
      console.error('❌ Ошибка при анализе сообщения ИИ:', error.message);
      return {
        success: false,
        error: error.message,
        tag: null,
        confidence: 0
      };
    }
  }
  
  /**
   * Анализ через OpenAI API
   */
  async analyzeWithOpenAI(prompt) {
    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Ты финансовый помощник. Анализируй сообщения пользователей и определяй наиболее подходящую категорию расхода/дохода.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    });
    
    return completion.choices[0]?.message?.content || '';
  }
  
  /**
   * Анализ через Perplexity API
   */
  async analyzeWithPerplexity(prompt) {
    const response = await axios.post('https://api.perplexity.ai/chat/completions', {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Ты финансовый помощник. Анализируй сообщения пользователей и определяй наиболее подходящую категорию расхода/дохода.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: this.maxTokens,
      temperature: this.temperature
    }, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: this.timeout * 1000
    });
    
    return response.data.choices[0]?.message?.content || '';
  }
  
  /**
   * Генерация промпта для анализа
   */
  generatePrompt(message, availableTags) {
    const tagsList = availableTags.map(tag => {
      let tagInfo = `- ${tag.title}`;
      if (tag.parent_title) {
        tagInfo += ` (подкатегория: ${tag.parent_title})`;
      }
      if (tag.description) {
        tagInfo += ` - ${tag.description}`;
      }
      return tagInfo;
    }).join('\n');
    
    return `Проанализируй сообщение пользователя и определи наиболее подходящий тег (категорию расхода/дохода) из предоставленного списка.

Сообщение пользователя: "${message}"

Доступные теги:
${tagsList}

Инструкции:
1. Выбери ОДИН наиболее подходящий тег
2. Если тег не найден, верни "Неопределено"
3. Ответ должен содержать только название тега
4. Не добавляй дополнительных объяснений

Ответ:`;
  }
  
  /**
   * Парсинг ответа ИИ
   */
  parseResponse(response) {
    try {
      const cleanResponse = response.trim();
      
      // Если ИИ вернул "Неопределено" или пустой ответ
      if (!cleanResponse || cleanResponse.toLowerCase().includes('неопределено')) {
        return {
          success: true,
          tag: null,
          confidence: 0,
          rawResponse: response
        };
      }
      
      // Попытка найти точное совпадение с доступными тегами
      // Это будет улучшено в следующих шагах с полным списком тегов
      
      return {
        success: true,
        tag: cleanResponse,
        confidence: 0.8, // Базовая уверенность
        rawResponse: response
      };
      
    } catch (error) {
      console.error('❌ Ошибка при парсинге ответа ИИ:', error.message);
      return {
        success: false,
        error: error.message,
        tag: null,
        confidence: 0
      };
    }
  }
  
  /**
   * Проверка доступности ИИ-сервиса
   */
  async testConnection() {
    try {
      const testPrompt = 'Тест соединения. Ответь "OK"';
      
      switch (this.provider) {
        case 'openai':
          await this.analyzeWithOpenAI(testPrompt);
          break;
        case 'perplexity':
          await this.analyzeWithPerplexity(testPrompt);
          break;
        default:
          throw new Error(`Неподдерживаемый провайдер: ${this.provider}`);
      }
      
      return { success: true };
      
    } catch (error) {
      console.error(`❌ Ошибка при тестировании соединения с ${this.provider}:`, error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = AIClient;
