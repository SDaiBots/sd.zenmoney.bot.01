-- =====================================================
-- SQL скрипт для создания многопользовательского режима
-- ZenMoney Telegram Bot
-- =====================================================

-- Отключаем автокоммит для безопасности
BEGIN;

-- =====================================================
-- 1. СОЗДАНИЕ НОВЫХ ТАБЛИЦ
-- =====================================================

-- 1.1 Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    zenmoney_token TEXT,
    zm_user_id INTEGER, -- ID пользователя в ZenMoney
    is_active BOOLEAN DEFAULT false,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.2 Таблица пользовательских настроек
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parameter_name VARCHAR(100) NOT NULL,
    parameter_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, parameter_name)
);

-- 1.3 Таблица статистики пользователей
CREATE TABLE IF NOT EXISTS user_statistics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    messages_sent INTEGER DEFAULT 0,
    messages_size BIGINT DEFAULT 0,
    tokens_used_sent INTEGER DEFAULT 0,
    tokens_used_received INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 1.4 Таблица сообщений пользователей
CREATE TABLE IF NOT EXISTS user_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    telegram_message_id BIGINT,
    chat_id BIGINT,
    message_type VARCHAR(20) NOT NULL, -- 'text', 'voice'
    original_text TEXT, -- исходный текст или транскрибация голоса
    message_size INTEGER, -- размер сообщения в байтах
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 1.5 Таблица транзакций
CREATE TABLE IF NOT EXISTS user_transactions (
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

-- 1.6 Таблица логов ИИ
CREATE TABLE IF NOT EXISTS user_ai_logs (
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

-- =====================================================
-- 2. ОБНОВЛЕНИЕ СУЩЕСТВУЮЩИХ ТАБЛИЦ
-- =====================================================

-- 2.1 Удаляем существующие представления, которые могут конфликтовать
-- Сначала удаляем все представления, которые могут ссылаться на ai_settings
DO $$
DECLARE
    view_name TEXT;
BEGIN
    -- Находим все представления, которые ссылаются на ai_settings (только в public схеме)
    FOR view_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE definition LIKE '%ai_settings%' 
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
    END LOOP;
    
    -- Находим все представления, которые ссылаются на provider (только в public схеме)
    FOR view_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE definition LIKE '%provider%' 
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
    END LOOP;
    
    -- Находим все представления, которые могут иметь конфликт с user_id (только в public схеме)
    FOR view_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE definition LIKE '%user_id%' AND definition LIKE '%provider%'
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
    END LOOP;
    
    -- Находим все представления, которые могут иметь конфликт с переименованием колонок (только в public схеме)
    FOR view_name IN 
        SELECT schemaname||'.'||viewname 
        FROM pg_views 
        WHERE (definition LIKE '%provider%' OR definition LIKE '%ai_settings%')
        AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP VIEW IF EXISTS ' || view_name || ' CASCADE';
    END LOOP;
END $$;

-- Удаляем известные представления
DROP VIEW IF EXISTS active_zm_tags CASCADE;
DROP VIEW IF EXISTS zm_tags_with_parent CASCADE;
DROP VIEW IF EXISTS active_ai_settings CASCADE;
DROP VIEW IF EXISTS ai_settings_view CASCADE;
DROP VIEW IF EXISTS user_ai_settings CASCADE;
DROP VIEW IF EXISTS ai_settings_active CASCADE;
DROP VIEW IF EXISTS active_ai_config CASCADE;
DROP VIEW IF EXISTS ai_config_active CASCADE;

-- 2.2 Добавить user_id в zm_accounts
ALTER TABLE zm_accounts ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 2.3 Добавить user_id в zm_tags
ALTER TABLE zm_tags ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- 2.4 Добавить user_id в ai_settings
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;

-- =====================================================
-- 3. СОЗДАНИЕ ИНДЕКСОВ
-- =====================================================

-- Индексы для таблицы users
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);
CREATE INDEX IF NOT EXISTS idx_users_last_activity ON users(last_activity);

-- Индексы для таблицы user_settings
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_parameter_name ON user_settings(parameter_name);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_parameter ON user_settings(user_id, parameter_name);

-- Индексы для таблицы user_statistics
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_last_updated ON user_statistics(last_updated);

-- Индексы для таблицы user_messages
CREATE INDEX IF NOT EXISTS idx_user_messages_user_id ON user_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_telegram_message_id ON user_messages(telegram_message_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_chat_id ON user_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_user_messages_message_type ON user_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_user_messages_created_at ON user_messages(created_at);

-- Индексы для таблицы user_transactions
CREATE INDEX IF NOT EXISTS idx_user_transactions_user_id ON user_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_message_id ON user_transactions(message_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_status ON user_transactions(status);
CREATE INDEX IF NOT EXISTS idx_user_transactions_zenmoney_id ON user_transactions(zenmoney_transaction_id);
CREATE INDEX IF NOT EXISTS idx_user_transactions_created_at ON user_transactions(created_at);

-- Индексы для таблицы user_ai_logs
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_user_id ON user_ai_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_message_id ON user_ai_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_ai_provider ON user_ai_logs(ai_provider);
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_ai_model ON user_ai_logs(ai_model);
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_success ON user_ai_logs(success);
CREATE INDEX IF NOT EXISTS idx_user_ai_logs_created_at ON user_ai_logs(created_at);

-- Индексы для обновленных таблиц
CREATE INDEX IF NOT EXISTS idx_zm_accounts_user_id ON zm_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_zm_tags_user_id ON zm_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_id ON ai_settings(user_id);

-- =====================================================
-- 4. ФУНКЦИИ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ
-- =====================================================

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 5. ТРИГГЕРЫ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ
-- =====================================================

-- Триггер для users
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для user_settings
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Триггер для user_transactions
CREATE TRIGGER update_user_transactions_updated_at 
    BEFORE UPDATE ON user_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. RLS (ROW LEVEL SECURITY) ПОЛИТИКИ
-- =====================================================

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
CREATE POLICY "Users can update own accounts" ON zm_accounts FOR UPDATE USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can delete own accounts" ON zm_accounts FOR DELETE USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для zm_tags
CREATE POLICY "Users can view own tags" ON zm_tags FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own tags" ON zm_tags FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can update own tags" ON zm_tags FOR UPDATE USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can delete own tags" ON zm_tags FOR DELETE USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_settings
CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can manage own settings" ON user_settings FOR ALL USING (user_id = current_setting('app.current_user_id')::integer);

-- Политики для user_statistics
CREATE POLICY "Users can view own statistics" ON user_statistics FOR SELECT USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can update own statistics" ON user_statistics FOR UPDATE USING (user_id = current_setting('app.current_user_id')::integer);
CREATE POLICY "Users can insert own statistics" ON user_statistics FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id')::integer);

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

-- =====================================================
-- 7. КОММЕНТАРИИ К ТАБЛИЦАМ И ПОЛЯМ
-- =====================================================

-- Комментарии к таблице users
COMMENT ON TABLE users IS 'Пользователи бота с их настройками и правами доступа';
COMMENT ON COLUMN users.telegram_id IS 'Уникальный ID пользователя в Telegram';
COMMENT ON COLUMN users.username IS 'Имя пользователя в Telegram (@username)';
COMMENT ON COLUMN users.first_name IS 'Имя пользователя';
COMMENT ON COLUMN users.last_name IS 'Фамилия пользователя';
COMMENT ON COLUMN users.zenmoney_token IS 'Токен доступа к ZenMoney API для пользователя';
COMMENT ON COLUMN users.is_active IS 'Активен ли пользователь (может ли использовать бота)';
COMMENT ON COLUMN users.is_admin IS 'Является ли пользователь администратором';
COMMENT ON COLUMN users.last_activity IS 'Время последней активности пользователя';

-- Комментарии к таблице user_settings
COMMENT ON TABLE user_settings IS 'Индивидуальные настройки пользователей';
COMMENT ON COLUMN user_settings.parameter_name IS 'Название параметра настройки';
COMMENT ON COLUMN user_settings.parameter_value IS 'Значение параметра настройки';

-- Комментарии к таблице user_statistics
COMMENT ON TABLE user_statistics IS 'Статистика использования бота по пользователям';
COMMENT ON COLUMN user_statistics.messages_sent IS 'Количество отправленных сообщений';
COMMENT ON COLUMN user_statistics.messages_size IS 'Общий размер отправленных сообщений в байтах';
COMMENT ON COLUMN user_statistics.tokens_used_sent IS 'Количество токенов, отправленных в ИИ';
COMMENT ON COLUMN user_statistics.tokens_used_received IS 'Количество токенов, полученных от ИИ';

-- Комментарии к таблице user_messages
COMMENT ON TABLE user_messages IS 'Сообщения пользователей (текстовые и голосовые)';
COMMENT ON COLUMN user_messages.telegram_message_id IS 'ID сообщения в Telegram';
COMMENT ON COLUMN user_messages.chat_id IS 'ID чата в Telegram';
COMMENT ON COLUMN user_messages.message_type IS 'Тип сообщения: text или voice';
COMMENT ON COLUMN user_messages.original_text IS 'Исходный текст или транскрибация голоса';
COMMENT ON COLUMN user_messages.message_size IS 'Размер сообщения в байтах';

-- Комментарии к таблице user_transactions
COMMENT ON TABLE user_transactions IS 'Транзакции, созданные на основе сообщений пользователей';
COMMENT ON COLUMN user_transactions.transaction_data IS 'Структура транзакции для ZenMoney в формате JSON';
COMMENT ON COLUMN user_transactions.zenmoney_transaction_id IS 'ID транзакции в ZenMoney (если успешно создана)';
COMMENT ON COLUMN user_transactions.status IS 'Статус транзакции: pending, success, failed, cancelled';
COMMENT ON COLUMN user_transactions.error_message IS 'Сообщение об ошибке (если транзакция не удалась)';

-- Комментарии к таблице user_ai_logs
COMMENT ON TABLE user_ai_logs IS 'Логи всех запросов к ИИ-сервисам';
COMMENT ON COLUMN user_ai_logs.ai_provider IS 'Провайдер ИИ-сервиса (openai, perplexity, anthropic)';
COMMENT ON COLUMN user_ai_logs.ai_model IS 'Модель ИИ, которая использовалась';
COMMENT ON COLUMN user_ai_logs.request_prompt IS 'Текст запроса, отправленный в ИИ';
COMMENT ON COLUMN user_ai_logs.response_text IS 'Текст ответа от ИИ';
COMMENT ON COLUMN user_ai_logs.response_data IS 'Полный ответ от ИИ в формате JSON';
COMMENT ON COLUMN user_ai_logs.tokens_used_sent IS 'Количество токенов, отправленных в ИИ';
COMMENT ON COLUMN user_ai_logs.tokens_used_received IS 'Количество токенов, полученных от ИИ';
COMMENT ON COLUMN user_ai_logs.processing_time_ms IS 'Время обработки запроса в миллисекундах';
COMMENT ON COLUMN user_ai_logs.success IS 'Успешно ли выполнен запрос к ИИ';
COMMENT ON COLUMN user_ai_logs.error_message IS 'Сообщение об ошибке (если запрос не удался)';

-- =====================================================
-- 8. ПРЕДСТАВЛЕНИЯ ДЛЯ УДОБСТВА
-- =====================================================

-- Пересоздаем представления для zm_tags с учетом user_id
CREATE OR REPLACE VIEW active_zm_tags AS
SELECT 
    id,
    user_id,
    title,
    parent_id,
    color,
    icon,
    picture,
    show_income,
    show_outcome,
    budget_income,
    budget_outcome,
    required,
    static_id,
    changed,
    created_at,
    updated_at
FROM zm_tags
WHERE archive = false;

CREATE OR REPLACE VIEW zm_tags_with_parent AS
SELECT 
    t.id,
    t.user_id,
    t.title,
    t.parent_id,
    p.title as parent_title,
    t.color,
    t.icon,
    t.picture,
    t.show_income,
    t.show_outcome,
    t.budget_income,
    t.budget_outcome,
    t.required,
    t.archive,
    t.static_id,
    t.changed,
    t.created_at,
    t.updated_at
FROM zm_tags t
LEFT JOIN zm_tags p ON t.parent_id = p.id;

-- Представление для активных пользователей
CREATE OR REPLACE VIEW active_users AS
SELECT 
    id,
    telegram_id,
    username,
    first_name,
    last_name,
    is_admin,
    created_at,
    last_activity
FROM users
WHERE is_active = true;

-- Представление для статистики пользователей с именами
CREATE OR REPLACE VIEW user_stats_with_names AS
SELECT 
    us.id,
    us.user_id,
    u.telegram_id,
    u.username,
    u.first_name,
    u.last_name,
    us.messages_sent,
    us.messages_size,
    us.tokens_used_sent,
    us.tokens_used_received,
    us.last_updated
FROM user_statistics us
JOIN users u ON us.user_id = u.id;

-- Представление для последних сообщений пользователей
CREATE OR REPLACE VIEW recent_user_messages AS
SELECT 
    um.id,
    um.user_id,
    u.telegram_id,
    u.username,
    u.first_name,
    um.message_type,
    um.original_text,
    um.message_size,
    um.created_at
FROM user_messages um
JOIN users u ON um.user_id = u.id
ORDER BY um.created_at DESC;

-- Представление для статистики ИИ по пользователям
CREATE OR REPLACE VIEW ai_usage_stats AS
SELECT 
    user_id,
    ai_provider,
    ai_model,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE success = true) as successful_requests,
    COUNT(*) FILTER (WHERE success = false) as failed_requests,
    SUM(tokens_used_sent) as total_tokens_sent,
    SUM(tokens_used_received) as total_tokens_received,
    AVG(processing_time_ms) as avg_processing_time_ms,
    MIN(created_at) as first_request,
    MAX(created_at) as last_request
FROM user_ai_logs
GROUP BY user_id, ai_provider, ai_model;

-- =====================================================
-- 9. ФУНКЦИИ ДЛЯ РАБОТЫ С ПОЛЬЗОВАТЕЛЯМИ
-- =====================================================

-- Функция для установки текущего пользователя (для RLS)
CREATE OR REPLACE FUNCTION set_current_user(user_id INTEGER)
RETURNS VOID AS $$
BEGIN
    PERFORM set_config('app.current_user_id', user_id::text, false);
END;
$$ LANGUAGE plpgsql;

-- Функция для получения текущего пользователя
CREATE OR REPLACE FUNCTION get_current_user()
RETURNS INTEGER AS $$
BEGIN
    RETURN current_setting('app.current_user_id')::integer;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Функция для создания пользователя
CREATE OR REPLACE FUNCTION create_user(
    p_telegram_id BIGINT,
    p_username VARCHAR(255) DEFAULT NULL,
    p_first_name VARCHAR(255) DEFAULT NULL,
    p_last_name VARCHAR(255) DEFAULT NULL,
    p_zenmoney_token TEXT DEFAULT NULL,
    p_is_admin BOOLEAN DEFAULT false
)
RETURNS INTEGER AS $$
DECLARE
    new_user_id INTEGER;
BEGIN
    INSERT INTO users (telegram_id, username, first_name, last_name, zenmoney_token, is_active, is_admin)
    VALUES (p_telegram_id, p_username, p_first_name, p_last_name, p_zenmoney_token, true, p_is_admin)
    RETURNING id INTO new_user_id;
    
    -- Создаем запись статистики для нового пользователя
    INSERT INTO user_statistics (user_id, messages_sent, messages_size, tokens_used_sent, tokens_used_received)
    VALUES (new_user_id, 0, 0, 0, 0);
    
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

-- Функция для активации/деактивации пользователя
CREATE OR REPLACE FUNCTION toggle_user_status(p_telegram_id BIGINT, p_is_active BOOLEAN)
RETURNS BOOLEAN AS $$
DECLARE
    user_exists BOOLEAN;
BEGIN
    UPDATE users 
    SET is_active = p_is_active, updated_at = NOW()
    WHERE telegram_id = p_telegram_id;
    
    GET DIAGNOSTICS user_exists = ROW_COUNT;
    RETURN user_exists > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. ЗАВЕРШЕНИЕ ТРАНЗАКЦИИ
-- =====================================================

-- Подтверждаем все изменения
COMMIT;

-- =====================================================
-- ИНФОРМАЦИОННОЕ СООБЩЕНИЕ
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Многопользовательская схема успешно создана!';
    RAISE NOTICE '📊 Создано таблиц: 6 новых + 3 обновленных';
    RAISE NOTICE '🔒 RLS политики включены для всех таблиц';
    RAISE NOTICE '📈 Создано представлений: 4';
    RAISE NOTICE '⚙️ Создано функций: 4';
    RAISE NOTICE '🎯 Готово к использованию!';
END $$;
