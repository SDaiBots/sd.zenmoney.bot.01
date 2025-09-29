-- Создание таблицы настроек
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    parameter_name VARCHAR(100) NOT NULL UNIQUE,
    parameter_synonym VARCHAR(200) NOT NULL,
    parameter_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Создание индекса для быстрого поиска по имени параметра
CREATE INDEX IF NOT EXISTS idx_settings_parameter_name ON settings(parameter_name);

-- Создание функции для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Создание триггера для автоматического обновления updated_at
CREATE TRIGGER update_settings_updated_at 
    BEFORE UPDATE ON settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Вставка примеров настроек
INSERT INTO settings (parameter_name, parameter_synonym, parameter_value) VALUES
    ('default_card', 'Карта (по умолчанию)', ''),
    ('default_cash', 'Бумажник (по умолчанию)', ''),
    ('default_currency', 'Валюта по умолчанию', 'RUB'),
    ('auto_sync_enabled', 'Автоматическая синхронизация', 'true'),
    ('sync_interval_minutes', 'Интервал синхронизации (минуты)', '30'),
    ('notification_enabled', 'Уведомления включены', 'true'),
    ('theme', 'Тема оформления', 'light'),
    ('language', 'Язык интерфейса', 'ru')
ON CONFLICT (parameter_name) DO NOTHING;

-- Комментарии к таблице и столбцам
COMMENT ON TABLE settings IS 'Таблица для хранения настроек приложения';
COMMENT ON COLUMN settings.parameter_name IS 'Уникальное имя параметра (например: default_card)';
COMMENT ON COLUMN settings.parameter_synonym IS 'Человекочитаемое название параметра (например: Карта по умолчанию)';
COMMENT ON COLUMN settings.parameter_value IS 'Значение параметра (может быть пустым)';
COMMENT ON COLUMN settings.created_at IS 'Дата и время создания записи';
COMMENT ON COLUMN settings.updated_at IS 'Дата и время последнего обновления записи';
