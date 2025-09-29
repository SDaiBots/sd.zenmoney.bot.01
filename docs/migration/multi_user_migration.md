# Переход к многопользовательскому режиму

## Текущее состояние (AS IS)

### Архитектура
- **Однопользовательский режим**: бот работает с одним глобальным токеном ZenMoney
- **Глобальные настройки**: все настройки хранятся в таблице `settings` без привязки к пользователям
- **Проверка доступа**: простая проверка по одному пользователю через настройку `user`
- **Нет изоляции данных**: все пользователи видят одни и те же счета и теги

### Структура базы данных
```sql
-- Текущие таблицы
zm_accounts (без user_id)
zm_tags (без user_id) 
settings (глобальные настройки)
ai_settings (глобальные настройки ИИ)
```

### Ограничения
- Только один пользователь может использовать бота
- Нет статистики по пользователям
- Нет возможности управления пользователями
- Все данные смешаны в одних таблицах

## Целевое состояние (TO BE)

### Архитектура
- **Многопользовательский режим**: каждый пользователь имеет свой токен ZenMoney
- **Пользовательские настройки**: индивидуальные настройки для каждого пользователя
- **Авторизация**: управление пользователями через администратора
- **Изоляция данных**: каждый пользователь видит только свои данные

### Структура базы данных
```sql
-- Новые таблицы
users (telegram_id, username, is_active, zenmoney_token, created_at, last_activity)
user_settings (user_id, parameter_name, parameter_value)
user_statistics (user_id, messages_sent, messages_size, tokens_used, last_updated)
user_messages (user_id, telegram_message_id, message_type, original_text, message_size)
user_transactions (user_id, message_id, transaction_data, zenmoney_transaction_id, status)
user_ai_logs (user_id, message_id, ai_provider, ai_model, request_prompt, response_text, tokens_used)

-- Обновленные таблицы
zm_accounts (добавить user_id)
zm_tags (добавить user_id)
settings (добавить user_id или сделать глобальными)
ai_settings (добавить user_id)
```

### Возможности
- Неограниченное количество пользователей
- Индивидуальные настройки для каждого пользователя
- Статистика использования по пользователям
- Административное управление пользователями
- Полная изоляция данных между пользователями
- Логирование всех сообщений и транзакций
- Отслеживание статуса транзакций в ZenMoney
- Аудит действий пользователей
- Логирование всех ИИ-запросов и ответов
- Статистика использования ИИ по пользователям

## План миграции

### 1. Создание схемы базы данных для многопользовательского режима

#### 1.1 Таблица пользователей
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    zenmoney_token TEXT,
    is_active BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.2 Таблица пользовательских настроек
```sql
CREATE TABLE user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, parameter_name)
);
```

#### 1.3 Таблица статистики пользователей
```sql
CREATE TABLE user_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    messages_sent INTEGER DEFAULT 0,
    messages_size BIGINT DEFAULT 0,
    tokens_used_sent INTEGER DEFAULT 0,
    tokens_used_received INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);
```

#### 1.4 Таблица сообщений пользователей
```sql
CREATE TABLE user_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    telegram_message_id BIGINT,
    chat_id BIGINT,
    message_type VARCHAR(20) NOT NULL, -- 'text', 'voice'
    original_text TEXT, -- исходный текст или транскрибация голоса
    message_size INTEGER, -- размер сообщения в байтах
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.5 Таблица транзакций
```sql
CREATE TABLE user_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES user_messages(id) ON DELETE CASCADE,
    transaction_data JSONB NOT NULL, -- структура транзакции для ZenMoney
    zenmoney_transaction_id VARCHAR(255), -- ID транзакции в ZenMoney (если создана)
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'cancelled'
    error_message TEXT, -- сообщение об ошибке (если есть)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.6 Таблица логов ИИ
```sql
CREATE TABLE user_ai_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    message_id INTEGER REFERENCES user_messages(id) ON DELETE CASCADE,
    ai_provider VARCHAR(50) NOT NULL, -- 'openai', 'perplexity', 'anthropic'
    ai_model VARCHAR(100) NOT NULL, -- модель ИИ
    request_prompt TEXT NOT NULL, -- что отправили в ИИ
    response_text TEXT, -- что получили от ИИ
    response_data JSONB, -- полный ответ от ИИ (JSON)
    tokens_used_sent INTEGER DEFAULT 0, -- токены отправленные
    tokens_used_received INTEGER DEFAULT 0, -- токены полученные
    processing_time_ms INTEGER, -- время обработки в миллисекундах
    success BOOLEAN NOT NULL DEFAULT true, -- успешность запроса
    error_message TEXT, -- сообщение об ошибке (если есть)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 1.7 Обновление существующих таблиц
```sql
-- Добавить user_id в zm_accounts
ALTER TABLE zm_accounts ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Добавить user_id в zm_tags  
ALTER TABLE zm_tags ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- Добавить user_id в ai_settings
ALTER TABLE ai_settings ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
```

#### 1.8 RLS (Row Level Security) политики
```sql
-- Включить RLS для всех таблиц
ALTER TABLE zm_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE zm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ai_logs ENABLE ROW LEVEL SECURITY;

-- Политики для zm_accounts
CREATE POLICY "Users can view own accounts" ON zm_accounts FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own accounts" ON zm_accounts FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);

-- Политики для zm_tags
CREATE POLICY "Users can view own tags" ON zm_tags FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own tags" ON zm_tags FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_settings
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_statistics
CREATE POLICY "Users can view own statistics" ON user_statistics FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can update own statistics" ON user_statistics FOR UPDATE USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для ai_settings
CREATE POLICY "Users can view own ai_settings" ON ai_settings FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can manage own ai_settings" ON ai_settings FOR ALL USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_messages
CREATE POLICY "Users can view own messages" ON user_messages FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own messages" ON user_messages FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_transactions
CREATE POLICY "Users can view own transactions" ON user_transactions FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can manage own transactions" ON user_transactions FOR ALL USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_ai_logs
CREATE POLICY "Users can view own ai_logs" ON user_ai_logs FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own ai_logs" ON user_ai_logs FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);
```

### 2. Обновление аутентификации и авторизации

#### 2.1 Новая функция проверки пользователя
```javascript
// Заменить isUserAllowed() на новую функцию
async function isUserAuthorized(telegramId, username) {
  try {
    if (!supabaseClient) {
      console.warn('⚠️ Supabase клиент не инициализирован');
      return { authorized: false, user: null };
    }

    const { data, error } = await supabaseClient
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      console.log(`🚫 Пользователь не авторизован: ID=${telegramId}, username=${username}`);
      return { authorized: false, user: null };
    }

    console.log(`✅ Пользователь авторизован: ${data.first_name} (ID: ${telegramId})`);
    return { authorized: true, user: data };

  } catch (error) {
    console.error('❌ Ошибка при проверке авторизации:', error.message);
    return { authorized: false, user: null };
  }
}
```

#### 2.2 Middleware для извлечения user_id
```javascript
// Добавить в SupabaseClient
async function setCurrentUser(userId) {
  try {
    await this.client.rpc('set_config', {
      setting_name: 'app.current_user_id',
      setting_value: userId.toString()
    });
  } catch (error) {
    console.error('❌ Ошибка при установке текущего пользователя:', error.message);
  }
}
```

### 3. Обновление пользовательских настроек

#### 3.1 Новые методы в SupabaseClient
```javascript
// Получение пользовательской настройки
async getUserSetting(userId, parameterName) {
  try {
    const { data, error } = await this.client
      .from('user_settings')
      .select('parameter_value')
      .eq('user_id', userId)
      .eq('parameter_name', parameterName)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return { 
      success: true, 
      value: data?.parameter_value || null,
      exists: !!data
    };

  } catch (error) {
    console.error(`❌ Ошибка при получении пользовательской настройки ${parameterName}:`, error.message);
    return { 
      success: false, 
      error: error.message,
      value: null,
      exists: false
    };
  }
}

// Обновление пользовательской настройки
async updateUserSetting(userId, parameterName, parameterValue) {
  try {
    const { data, error } = await this.client
      .from('user_settings')
      .upsert({
        user_id: userId,
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
    console.error(`❌ Ошибка при обновлении пользовательской настройки ${parameterName}:`, error.message);
    return { success: false, error: error.message };
  }
}
```

#### 3.2 Обновление логики получения настроек
```javascript
// В handleTransactionWithAI заменить получение настроек
async function getUserSettings(userId) {
  try {
    const defaultCardResult = await supabaseClient.getUserSetting(userId, 'default_card');
    const defaultCashResult = await supabaseClient.getUserSetting(userId, 'default_cash');
    
    return {
      default_card: (defaultCardResult.success && defaultCardResult.value && defaultCardResult.value.trim() !== '') 
        ? defaultCardResult.value.trim() 
        : 'Карта',
      default_cash: (defaultCashResult.success && defaultCashResult.value && defaultCashResult.value.trim() !== '') 
        ? defaultCashResult.value.trim() 
        : 'Бумажник'
    };
  } catch (error) {
    console.warn('⚠️ Ошибка при получении пользовательских настроек:', error.message);
    return {
      default_card: 'Карта',
      default_cash: 'Бумажник'
    };
  }
}
```

### 4. Обновление ZenMoney API

#### 4.1 Обновление ZenMoneyAPI класса
```javascript
class ZenMoneyAPI {
  constructor(accessToken = null) {
    this.baseURL = process.env.ZENMONEY_API_BASE_URL || 'https://api.zenmoney.ru';
    this.accessToken = accessToken || process.env.ZENMONEY_TOKEN;
    
    if (!this.accessToken) {
      throw new Error('ZENMONEY_TOKEN не установлен');
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
}
```

#### 4.2 Обновление использования в коде
```javascript
// В handleAccountsCommand и других местах
async function handleAccountsCommand(chatId, user, messageId) {
  if (!user.zenmoney_token) {
    bot.sendMessage(chatId, '❌ ZenMoney токен не настроен. Обратитесь к администратору.', {
      reply_to_message_id: messageId
    });
    return;
  }

  try {
    const zenMoneyAPI = new ZenMoneyAPI(user.zenmoney_token);
    // ... остальная логика
  } catch (error) {
    // ... обработка ошибок
  }
}
```

### 5. Обновление ИИ-настроек

#### 5.1 Пользовательские ИИ-настройки
```javascript
// Получение пользовательских ИИ-настроек
async getUserAISettings(userId) {
  try {
    const { data, error } = await this.client
      .from('ai_settings')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return { success: true, data: data || null };

  } catch (error) {
    console.error('❌ Ошибка при получении пользовательских ИИ-настроек:', error.message);
    return { success: false, error: error.message, data: null };
  }
}
```

#### 5.2 Fallback на глобальные настройки и логирование
```javascript
// В analyzeMessageWithAI
async function analyzeMessageWithAI(message, supabaseClient, userId, messageId = null) {
  const startTime = Date.now();
  let aiLogData = {
    provider: null,
    model: null,
    request_prompt: message,
    response_text: null,
    response_data: null,
    tokens_used_sent: 0,
    tokens_used_received: 0,
    success: false,
    error_message: null
  };

  try {
    // Сначала пытаемся получить пользовательские настройки
    let settingsResult = await supabaseClient.getUserAISettings(userId);
    
    // Если пользовательских настроек нет, используем глобальные
    if (!settingsResult.success || !settingsResult.data) {
      console.log('⚠️ Пользовательские ИИ-настройки не найдены, используем глобальные');
      settingsResult = await supabaseClient.getActiveAISettings();
    }
    
    if (!settingsResult.success || !settingsResult.data) {
      throw new Error('Настройки ИИ не найдены');
    }

    const aiSettings = settingsResult.data;
    aiLogData.provider = aiSettings.provider;
    aiLogData.model = aiSettings.model;

    // Получаем доступные теги
    const tagsResult = await supabaseClient.getAllTagsWithParents();
    if (!tagsResult.success || !tagsResult.data) {
      throw new Error('Теги не найдены');
    }

    const availableTags = tagsResult.data.filter(tag => tag.parent_id !== null);
    
    // Создаем клиент ИИ и анализируем сообщение
    const aiClient = new AIClient(aiSettings);
    const analysisResult = await aiClient.analyzeMessage(message, availableTags);
    
    // Заполняем данные лога
    aiLogData.response_text = analysisResult.rawResponse || '';
    aiLogData.response_data = analysisResult;
    aiLogData.tokens_used_sent = analysisResult.tokensUsed?.sent || 0;
    aiLogData.tokens_used_received = analysisResult.tokensUsed?.received || 0;
    aiLogData.success = analysisResult.success;
    aiLogData.error_message = analysisResult.error || null;
    aiLogData.processing_time_ms = Date.now() - startTime;

    // Сохраняем лог ИИ
    if (messageId) {
      try {
        await supabaseClient.saveAILog(userId, messageId, aiLogData);
      } catch (logError) {
        console.error('❌ Ошибка при сохранении лога ИИ:', logError.message);
      }
    }

    return analysisResult;
    
  } catch (error) {
    console.error('❌ Критическая ошибка при анализе сообщения ИИ:', error.message);
    
    // Заполняем данные лога для ошибки
    aiLogData.success = false;
    aiLogData.error_message = error.message;
    aiLogData.processing_time_ms = Date.now() - startTime;

    // Сохраняем лог ИИ даже при ошибке
    if (messageId) {
      try {
        await supabaseClient.saveAILog(userId, messageId, aiLogData);
      } catch (logError) {
        console.error('❌ Ошибка при сохранении лога ИИ (ошибка):', logError.message);
      }
    }

    return {
      success: false,
      error: error.message,
      tags: [],
      primaryTag: null,
      confidence: 0
    };
  }
}
```

### 6. Добавление логирования сообщений и транзакций

#### 6.1 Методы для работы с сообщениями
```javascript
// Сохранение сообщения пользователя
async function saveUserMessage(userId, messageData) {
  try {
    const { data, error } = await this.client
      .from('user_messages')
      .insert({
        user_id: userId,
        telegram_message_id: messageData.telegram_message_id,
        chat_id: messageData.chat_id,
        message_type: messageData.message_type, // 'text' или 'voice'
        original_text: messageData.original_text,
        message_size: messageData.message_size
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при сохранении сообщения:', error.message);
    return { success: false, error: error.message };
  }
}

// Получение сообщений пользователя
async function getUserMessages(userId, limit = 50) {
  try {
    const { data, error } = await this.client
      .from('user_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при получении сообщений пользователя:', error.message);
    return { success: false, error: error.message };
  }
}
```

#### 6.2 Методы для работы с логами ИИ
```javascript
// Сохранение лога ИИ-запроса
async function saveAILog(userId, messageId, aiLogData) {
  try {
    const { data, error } = await this.client
      .from('user_ai_logs')
      .insert({
        user_id: userId,
        message_id: messageId,
        ai_provider: aiLogData.provider,
        ai_model: aiLogData.model,
        request_prompt: aiLogData.request_prompt,
        response_text: aiLogData.response_text,
        response_data: aiLogData.response_data,
        tokens_used_sent: aiLogData.tokens_used_sent || 0,
        tokens_used_received: aiLogData.tokens_used_received || 0,
        processing_time_ms: aiLogData.processing_time_ms,
        success: aiLogData.success !== false,
        error_message: aiLogData.error_message
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при сохранении лога ИИ:', error.message);
    return { success: false, error: error.message };
  }
}

// Получение логов ИИ пользователя
async function getUserAILogs(userId, limit = 50) {
  try {
    const { data, error } = await this.client
      .from('user_ai_logs')
      .select(`
        *,
        user_messages (
          message_type,
          original_text,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при получении логов ИИ пользователя:', error.message);
    return { success: false, error: error.message };
  }
}

// Получение статистики использования ИИ
async function getAIUsageStats(userId, days = 30) {
  try {
    const { data, error } = await this.client
      .from('user_ai_logs')
      .select('tokens_used_sent, tokens_used_received, success, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      throw error;
    }

    const stats = {
      total_requests: data.length,
      successful_requests: data.filter(log => log.success).length,
      failed_requests: data.filter(log => !log.success).length,
      total_tokens_sent: data.reduce((sum, log) => sum + (log.tokens_used_sent || 0), 0),
      total_tokens_received: data.reduce((sum, log) => sum + (log.tokens_used_received || 0), 0),
      avg_processing_time: data.reduce((sum, log) => sum + (log.processing_time_ms || 0), 0) / data.length || 0
    };

    return { success: true, data: stats };

  } catch (error) {
    console.error('❌ Ошибка при получении статистики ИИ:', error.message);
    return { success: false, error: error.message };
  }
}
```

#### 6.3 Методы для работы с транзакциями
```javascript
// Создание транзакции
async function createUserTransaction(userId, messageId, transactionData) {
  try {
    const { data, error } = await this.client
      .from('user_transactions')
      .insert({
        user_id: userId,
        message_id: messageId,
        transaction_data: transactionData,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при создании транзакции:', error.message);
    return { success: false, error: error.message };
  }
}

// Обновление статуса транзакции
async function updateTransactionStatus(transactionId, status, zenmoneyTransactionId = null, errorMessage = null) {
  try {
    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    };

    if (zenmoneyTransactionId) {
      updateData.zenmoney_transaction_id = zenmoneyTransactionId;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { data, error } = await this.client
      .from('user_transactions')
      .update(updateData)
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при обновлении статуса транзакции:', error.message);
    return { success: false, error: error.message };
  }
}

// Получение транзакций пользователя
async function getUserTransactions(userId, limit = 50) {
  try {
    const { data, error } = await this.client
      .from('user_transactions')
      .select(`
        *,
        user_messages (
          message_type,
          original_text,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при получении транзакций пользователя:', error.message);
    return { success: false, error: error.message };
  }
}
```

### 7. Добавление статистики пользователей

#### 7.1 Методы для работы со статистикой
```javascript
// Получение статистики пользователя
async getUserStatistics(userId) {
  try {
    const { data, error } = await this.client
      .from('user_statistics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return { success: true, data: data || null };

  } catch (error) {
    console.error('❌ Ошибка при получении статистики пользователя:', error.message);
    return { success: false, error: error.message, data: null };
  }
}

// Обновление статистики пользователя
async updateUserStatistics(userId, stats) {
  try {
    const { data, error } = await this.client
      .from('user_statistics')
      .upsert({
        user_id: userId,
        messages_sent: stats.messages_sent || 0,
        messages_size: stats.messages_size || 0,
        tokens_used_sent: stats.tokens_used_sent || 0,
        tokens_used_received: stats.tokens_used_received || 0,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { success: true, data };

  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики пользователя:', error.message);
    return { success: false, error: error.message };
  }
}
```

#### 6.4 Интеграция логирования в обработчики сообщений
```javascript
// Обновленная функция handleMessage
async function handleMessage(message) {
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const text = message.text;
  const voice = message.voice;
  
  // Получаем информацию о пользователе
  const user = message.from;
  const userName = user.first_name || user.username || 'Неизвестный пользователь';
  const userLastName = user.last_name ? ` ${user.last_name}` : '';
  const fullUserName = `${userName}${userLastName}`;
  
  // Проверяем авторизацию
  const authResult = await isUserAuthorized(user.id, user.username);
  
  if (!authResult.authorized) {
    console.log(`🚫 Игнорируем сообщение от неавторизованного пользователя: ${fullUserName} (ID: ${user.id})`);
    return;
  }

  const currentUser = authResult.user;
  
  // Сохраняем сообщение в базу данных
  let savedMessage = null;
  try {
    const messageData = {
      telegram_message_id: messageId,
      chat_id: chatId,
      message_type: voice ? 'voice' : 'text',
      original_text: text || '', // для голосовых сообщений будет обновлено после транскрибации
      message_size: text ? text.length : 0
    };

    const saveResult = await supabaseClient.saveUserMessage(currentUser.id, messageData);
    if (saveResult.success) {
      savedMessage = saveResult.data;
    }
  } catch (error) {
    console.error('❌ Ошибка при сохранении сообщения:', error.message);
  }
  
  // Обработка команд
  if (text && text.startsWith('/')) {
    handleCommand(message, currentUser);
    return;
  }
  
  // Обработка голосовых сообщений
  if (voice) {
    await handleVoiceMessage(chatId, voice, user, fullUserName, messageId, currentUser, savedMessage);
    return;
  }
  
  // Обработка обычных сообщений
  if (text) {
    handleTransactionWithAI(chatId, text, user, fullUserName, false, messageId, currentUser, savedMessage);
  }
}

// Обновленная функция handleVoiceMessage
async function handleVoiceMessage(chatId, voice, user, fullUserName, messageId, currentUser, savedMessage) {
  try {
    console.log(`🎤 Получено голосовое сообщение от пользователя ${fullUserName}`);
    
    // Отправляем сообщение о начале обработки
    const processingMessage = await bot.sendMessage(chatId, '🎤 Обрабатываю голосовое сообщение...', {
      reply_to_message_id: messageId
    });
    
    // Скачиваем аудиофайл
    const audioBuffer = await downloadVoiceFile(voice.file_id);
    
    // Транскрибируем голос
    const transcribedText = await transcribeVoice(audioBuffer);
    
    // Обновляем сохраненное сообщение с транскрибацией
    if (savedMessage) {
      try {
        await supabaseClient.updateUserMessage(savedMessage.id, {
          original_text: transcribedText,
          message_size: transcribedText.length
        });
      } catch (error) {
        console.error('❌ Ошибка при обновлении сообщения транскрибацией:', error.message);
      }
    }
    
    // Удаляем сообщение о обработке
    await bot.deleteMessage(chatId, processingMessage.message_id);
    
    if (!transcribedText || transcribedText.trim() === '') {
      await bot.sendMessage(chatId, '❌ Не удалось распознать речь в голосовом сообщении. Попробуйте еще раз.', {
        reply_to_message_id: messageId
      });
      return;
    }
    
    // Отправляем сообщение с результатом транскрибации
    await bot.sendMessage(chatId, `🎤 *Распознанный текст:*\n"${transcribedText}"`, { 
      parse_mode: 'Markdown',
      reply_to_message_id: messageId
    });
    
    // Обрабатываем транскрибированный текст
    await handleTransactionWithAI(chatId, transcribedText, user, fullUserName, true, messageId, currentUser, savedMessage);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке голосового сообщения:', error.message);
    
    // Отправляем сообщение об ошибке
    let errorMessage = '❌ Ошибка при обработке голосового сообщения.';
    
    if (error.message.includes('timeout')) {
      errorMessage = '⏱️ Время обработки голосового сообщения истекло. Попробуйте отправить более короткое сообщение.';
    } else if (error.message.includes('API key')) {
      errorMessage = '🔑 Ошибка API ключа OpenAI. Обратитесь к администратору.';
    } else if (error.message.includes('file')) {
      errorMessage = '📁 Ошибка при скачивании голосового файла. Попробуйте еще раз.';
    }
    
    await bot.sendMessage(chatId, errorMessage, {
      reply_to_message_id: messageId
    });
  }
}

// Обновленная функция handleTransactionWithAI
async function handleTransactionWithAI(chatId, text, user, fullUserName, isVoiceMessage = false, replyToMessageId = null, currentUser, savedMessage) {
  try {
    // Получаем пользовательские настройки
    const settings = await getUserSettings(currentUser.id);
    
    // Запускаем ИИ-анализ с логированием
    const aiResult = await analyzeMessageWithAI(text, supabaseClient, currentUser.id, savedMessage?.id);
    
    // Создаем единое сообщение транзакции
    const unifiedResult = await createUnifiedTransactionMessage(text, aiResult, settings, supabaseClient, isVoiceMessage);
    
    if (!unifiedResult.success) {
      throw new Error(unifiedResult.error);
    }
    
    // Создаем транзакцию в базе данных
    let transaction = null;
    if (savedMessage) {
      try {
        const transactionData = {
          tag: unifiedResult.transactionData.tag,
          account: unifiedResult.transactionData.account,
          amount: unifiedResult.transactionData.amount,
          comment: unifiedResult.transactionData.comment
        };

        const createResult = await supabaseClient.createUserTransaction(currentUser.id, savedMessage.id, transactionData);
        if (createResult.success) {
          transaction = createResult.data;
        }
      } catch (error) {
        console.error('❌ Ошибка при создании транзакции:', error.message);
      }
    }
    
    // Создаем клавиатуру с тегами от ИИ
    const keyboard = createUnifiedTransactionKeyboard(unifiedResult.transactionData, unifiedResult.hasMultipleTags, unifiedResult.aiTags);
    
    // Отправляем единое сообщение
    const message = await bot.sendMessage(chatId, unifiedResult.messageText, {
      reply_markup: {
        inline_keyboard: keyboard
      },
      reply_to_message_id: replyToMessageId
    });
    
    // Сохраняем исходные теги от ИИ для этого сообщения
    const messageKey = `${chatId}_${message.message_id}`;
    aiTagsStorage.set(messageKey, unifiedResult.aiTags);
    
    // Сохраняем связь между сообщениями и транзакцией
    if (transaction) {
      messageTransactionMap.set(messageKey, transaction.id);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обработке транзакции с ИИ:', error.message);
    
    // Fallback: отправляем простое сообщение об ошибке
    bot.sendMessage(chatId, `❌ Ошибка при обработке сообщения: ${error.message}`, {
      reply_to_message_id: replyToMessageId
    });
  }
}
```

#### 7.2 Интеграция сбора статистики
```javascript
// В handleMessage добавить сбор статистики
async function handleMessage(message) {
  // ... существующая логика авторизации
  
  if (isAllowed) {
    // Обновляем статистику
    await updateUserMessageStats(user.id, message.text?.length || 0);
    
    // ... остальная логика
  }
}

async function updateUserMessageStats(userId, messageSize) {
  try {
    const statsResult = await supabaseClient.getUserStatistics(userId);
    const currentStats = statsResult.data || {};
    
    await supabaseClient.updateUserStatistics(userId, {
      messages_sent: (currentStats.messages_sent || 0) + 1,
      messages_size: (currentStats.messages_size || 0) + messageSize,
      tokens_used_sent: currentStats.tokens_used_sent || 0,
      tokens_used_received: currentStats.tokens_used_received || 0
    });
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики:', error.message);
  }
}
```

### 8. Обновление обработчиков транзакций

#### 8.1 Обновленная функция handleUnifiedApply
```javascript
// Функция обработки применения транзакции в едином сообщении
async function handleUnifiedApply(chatId, messageId, originalMessage) {
  try {
    // Получаем ID транзакции из хранилища
    const messageKey = `${chatId}_${messageId}`;
    const transactionId = messageTransactionMap.get(messageKey);
    
    if (!transactionId) {
      bot.editMessageText('❌ Ошибка: транзакция не найдена', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }

    // Парсим данные транзакции из сообщения
    const transactionData = parseTransactionFromMessage(originalMessage);
    if (!transactionData) {
      bot.editMessageText('❌ Ошибка при парсинге данных транзакции', {
        chat_id: chatId,
        message_id: messageId
      });
      return;
    }
    
    // Создаем транзакцию в ZenMoney
    const createResult = await createTransactionInZenMoney(transactionData, supabaseClient);
    
    if (createResult.success) {
      // Обновляем статус транзакции в базе данных
      await supabaseClient.updateTransactionStatus(
        transactionId, 
        'success', 
        createResult.zenmoneyTransactionId
      );
      
      // Формируем новое сообщение с подтверждением
      const successMessage = `✅ Запись добавлена

${transactionData.tag.title}
${transactionData.account.name}
${transactionData.formattedAmount} ₽
${transactionData.comment}`;
      
      // Обновляем сообщение без кнопок
      bot.editMessageText(successMessage, {
        chat_id: chatId,
        message_id: messageId
      });
      
    } else {
      // Обновляем статус транзакции с ошибкой
      await supabaseClient.updateTransactionStatus(
        transactionId, 
        'failed', 
        null, 
        createResult.error
      );
      
      // Обрабатываем ошибку создания
      const errorMessage = `❌ Ошибка при создании записи в ZenMoney

${createResult.error}

💡 Проверьте настройки подключения к ZenMoney API.`;
      
      bot.editMessageText(errorMessage, {
        chat_id: chatId,
        message_id: messageId
      });
      
      console.error('❌ Ошибка при создании транзакции в ZenMoney:', createResult.error);
    }
    
  } catch (error) {
    console.error('❌ Ошибка при обработке применения транзакции:', error.message);
    bot.editMessageText('❌ Ошибка при обработке транзакции', {
      chat_id: chatId,
      message_id: messageId
    });
  }
}
```

#### 8.2 Обновленная функция handleUnifiedCancel
```javascript
// Функция обработки отмены транзакции в едином сообщении
async function handleUnifiedCancel(chatId, messageId, originalMessage) {
  try {
    // Получаем ID транзакции из хранилища
    const messageKey = `${chatId}_${messageId}`;
    const transactionId = messageTransactionMap.get(messageKey);
    
    if (transactionId) {
      // Обновляем статус транзакции в базе данных
      await supabaseClient.updateTransactionStatus(transactionId, 'cancelled');
    }
    
    // Добавляем зачеркивание ко всем строкам структуры и экранируем
    const strikethroughStructure = originalMessage.split('\n').map(line => {
      if (!line.trim()) return line;
      
      // Экранируем специальные символы MarkdownV2
      const escapedLine = line.trim()
        .replace(/\\/g, '\\\\')
        .replace(/\*/g, '\\*')
        .replace(/_/g, '\\_')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/~/g, '\\~')
        .replace(/`/g, '\\`')
        .replace(/>/g, '\\>')
        .replace(/#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/-/g, '\\-')
        .replace(/=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/!/g, '\\!');
      
      return `~~${escapedLine}~~`;
    }).join('\n');
    
    // Формируем новое сообщение
    const newMessage = `❌ Запись отменена

${strikethroughStructure}`;
    
    // Обновляем сообщение без кнопок
    bot.editMessageText(newMessage, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'MarkdownV2'
    });
    
  } catch (error) {
    console.error('Ошибка при отмене транзакции в едином сообщении:', error);
  }
}
```

### 9. Административные функции

#### 9.1 Команды для администраторов
```javascript
// Проверка прав администратора
async function isAdmin(userId) {
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('is_admin')
      .eq('telegram_id', userId)
      .single();

    return data?.is_admin || false;
  } catch (error) {
    console.error('❌ Ошибка при проверке прав администратора:', error.message);
    return false;
  }
}

// Команда /admin_users
async function handleAdminUsersCommand(chatId, userId, messageId) {
  if (!(await isAdmin(userId))) {
    bot.sendMessage(chatId, '❌ У вас нет прав администратора.', {
      reply_to_message_id: messageId
    });
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('telegram_id, username, first_name, is_active, is_admin, created_at, last_activity')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    let message = '👥 *Список пользователей:*\n\n';
    data.forEach((user, index) => {
      const status = user.is_active ? '✅' : '❌';
      const admin = user.is_admin ? '👑' : '';
      const lastActivity = user.last_activity ? new Date(user.last_activity).toLocaleDateString('ru-RU') : 'Никогда';
      
      message += `${index + 1}. ${status} ${admin} ${user.first_name || user.username || 'Без имени'}\n`;
      message += `   ID: ${user.telegram_id}\n`;
      message += `   Последняя активность: ${lastActivity}\n\n`;
    });

    bot.sendMessage(chatId, message, { 
      parse_mode: 'Markdown',
      reply_to_message_id: messageId
    });

  } catch (error) {
    console.error('❌ Ошибка при получении списка пользователей:', error.message);
    bot.sendMessage(chatId, '❌ Ошибка при получении списка пользователей.', {
      reply_to_message_id: messageId
    });
  }
}

// Команда /admin_activate
async function handleAdminActivateCommand(chatId, userId, messageId, targetUserId) {
  if (!(await isAdmin(userId))) {
    bot.sendMessage(chatId, '❌ У вас нет прав администратора.', {
      reply_to_message_id: messageId
    });
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('telegram_id', targetUserId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    bot.sendMessage(chatId, `✅ Пользователь ${data.first_name || data.username} активирован.`, {
      reply_to_message_id: messageId
    });

  } catch (error) {
    console.error('❌ Ошибка при активации пользователя:', error.message);
    bot.sendMessage(chatId, '❌ Ошибка при активации пользователя.', {
      reply_to_message_id: messageId
    });
  }
}
```

### 10. Миграция существующих данных

#### 10.1 Скрипт миграции
```sql
-- Создание первого пользователя из существующих данных
INSERT INTO users (telegram_id, username, first_name, is_active, is_admin, zenmoney_token)
VALUES (
  (SELECT parameter_value::bigint FROM settings WHERE parameter_name = 'user'),
  'admin',
  'Администратор',
  true,
  true,
  'existing_zenmoney_token'
);

-- Получение ID созданного пользователя
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE is_admin = true LIMIT 1;
    
    -- Обновление существующих записей
    UPDATE zm_accounts SET user_id = admin_user_id WHERE user_id IS NULL;
    UPDATE zm_tags SET user_id = admin_user_id WHERE user_id IS NULL;
    UPDATE ai_settings SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- Перенос настроек в user_settings
    INSERT INTO user_settings (user_id, parameter_name, parameter_value)
    SELECT admin_user_id, parameter_name, parameter_value
    FROM settings
    WHERE parameter_name IN ('default_card', 'default_cash');
    
    -- Создание записи статистики
    INSERT INTO user_statistics (user_id, messages_sent, messages_size, tokens_used_sent, tokens_used_received)
    VALUES (admin_user_id, 0, 0, 0, 0);
END $$;
```

### 11. Обновление переменных окружения

#### 11.1 Новые переменные
```env
# Многопользовательский режим
MULTI_USER_MODE=true
DEFAULT_ADMIN_TELEGRAM_ID=your_admin_telegram_id

# Статистика
ENABLE_USER_STATISTICS=true
STATISTICS_RETENTION_DAYS=365

# Безопасность
ENABLE_RLS=true
SESSION_TIMEOUT_MINUTES=60
```

### 12. Тестирование

#### 12.1 Unit тесты
```javascript
// Тесты для пользовательских настроек
describe('User Settings', () => {
  test('should get user setting', async () => {
    const result = await supabaseClient.getUserSetting(1, 'default_card');
    expect(result.success).toBe(true);
  });

  test('should update user setting', async () => {
    const result = await supabaseClient.updateUserSetting(1, 'default_card', 'Новая карта');
    expect(result.success).toBe(true);
  });
});

// Тесты для статистики
describe('User Statistics', () => {
  test('should get user statistics', async () => {
    const result = await supabaseClient.getUserStatistics(1);
    expect(result.success).toBe(true);
  });

  test('should update user statistics', async () => {
    const result = await supabaseClient.updateUserStatistics(1, {
      messages_sent: 10,
      messages_size: 1000
    });
    expect(result.success).toBe(true);
  });
});
```

#### 12.2 Интеграционные тесты
```javascript
// Тест изоляции данных
describe('Data Isolation', () => {
  test('user should only see own data', async () => {
    // Создаем двух пользователей
    const user1 = await createTestUser(1);
    const user2 = await createTestUser(2);
    
    // Добавляем данные для каждого пользователя
    await addTestAccount(user1.id, 'Account 1');
    await addTestAccount(user2.id, 'Account 2');
    
    // Проверяем изоляцию
    const user1Accounts = await getUserAccounts(user1.id);
    const user2Accounts = await getUserAccounts(user2.id);
    
    expect(user1Accounts).toHaveLength(1);
    expect(user2Accounts).toHaveLength(1);
    expect(user1Accounts[0].title).toBe('Account 1');
    expect(user2Accounts[0].title).toBe('Account 2');
  });
});
```

## Статус выполнения

### ✅ Выполнено
1. **Создание схемы БД** - SQL скрипт `multi_user_schema.sql` успешно выполнен
   - Созданы все необходимые таблицы для многопользовательского режима
   - Настроены RLS политики для изоляции данных
   - Добавлены индексы для оптимизации производительности
   - Созданы функции и представления для управления пользователями

### 🔄 В процессе
2. **Обновление аутентификации** - безопасность и доступ
3. **Пользовательские настройки** - индивидуальная конфигурация
4. **ZenMoney API** - работа с индивидуальными токенами
5. **Логирование сообщений и транзакций** - аудит и отслеживание
6. **Логирование ИИ-запросов** - мониторинг использования ИИ

### 📋 Планируется
7. **ИИ-настройки** - персонализация ИИ
8. **Статистика пользователей** - мониторинг использования
9. **Административные функции** - управление пользователями
10. **Обновление обработчиков транзакций** - интеграция с логированием
11. **Миграция данных** - перенос существующих данных
12. **Тестирование** - качество и надежность
13. **Документация** - сопровождение

## Оценка времени

- **Выполнено**: 1 неделя
- **В процессе**: 3-4 недели
- **Планируется**: 2-3 недели
- **Итого**: 6-8 недель

## Риски и митигация

### Риски
1. **Потеря данных при миграции** - создать резервные копии
2. **Нарушение работы существующих пользователей** - поэтапное внедрение
3. **Проблемы с производительностью** - оптимизация запросов и индексов
4. **Сложность отладки** - подробное логирование

### Митигация
1. **Резервное копирование** перед каждым этапом
2. **Тестирование на копии** продакшн данных
3. **Мониторинг производительности** после внедрения
4. **Постепенное включение** новых функций

## Заключение

Переход к многопользовательскому режиму требует значительных изменений в архитектуре, но обеспечит масштабируемость и безопасность системы. План предусматривает поэтапное внедрение с минимальным риском для существующих пользователей.

## Достижения

### ✅ Успешно выполнено
- **Создание схемы БД**: SQL скрипт `multi_user_schema.sql` успешно выполнен
- **Настройка RLS**: Политики безопасности для изоляции данных пользователей
- **Создание функций**: Управление пользователями, статистика, логирование
- **Оптимизация**: Индексы и представления для производительности

### 🔧 Исправленные проблемы
- Конфликты представлений при добавлении `user_id` в существующие таблицы
- Ошибки с системными представлениями PostgreSQL
- Проблемы с `GET DIAGNOSTICS FOUND` в функциях

### 📊 Созданная инфраструктура
- 6 новых таблиц для многопользовательского режима
- 3 обновленные таблицы с поддержкой `user_id`
- 15+ RLS политик для безопасности
- 5 функций для управления пользователями
- 4 представления для аналитики и мониторинга

База данных готова для многопользовательского режима. Следующий этап - обновление кода приложения.
