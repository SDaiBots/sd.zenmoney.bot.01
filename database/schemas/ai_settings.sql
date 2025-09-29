-- Создание таблицы настроек ИИ для пользователей
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    provider VARCHAR(50),                        -- openai, perplexity, anthropic
    model VARCHAR(100),                          -- модель ИИ
    api_key TEXT,                               -- API ключ для выбранного провайдера
    max_tokens INTEGER DEFAULT 1000,
    temperature NUMERIC DEFAULT 0.3,
    timeout INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT false,            -- только одна запись должна быть активной
    description TEXT,                           -- описание конфигурации
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индекса для быстрого поиска активной конфигурации
CREATE INDEX IF NOT EXISTS idx_ai_settings_is_active ON ai_settings(is_active);

-- Создание триггера для автоматического обновления updated_at
CREATE TRIGGER update_ai_settings_updated_at 
    BEFORE UPDATE ON ai_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблице и столбцам
COMMENT ON TABLE ai_settings IS 'Таблица для хранения настроек ИИ-сервисов';
COMMENT ON COLUMN ai_settings.provider IS 'Провайдер ИИ-сервиса (openai, perplexity, anthropic)';
COMMENT ON COLUMN ai_settings.model IS 'Модель ИИ для использования';
COMMENT ON COLUMN ai_settings.api_key IS 'API ключ для выбранного провайдера';
COMMENT ON COLUMN ai_settings.max_tokens IS 'Максимальное количество токенов в ответе';
COMMENT ON COLUMN ai_settings.temperature IS 'Температура для генерации (0.0-1.0)';
COMMENT ON COLUMN ai_settings.timeout IS 'Таймаут запроса в секундах';
COMMENT ON COLUMN ai_settings.is_active IS 'Активна ли данная конфигурация (только одна должна быть true)';
COMMENT ON COLUMN ai_settings.description IS 'Описание конфигурации';
COMMENT ON COLUMN ai_settings.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN ai_settings.updated_at IS 'Дата и время последнего обновления записи';
