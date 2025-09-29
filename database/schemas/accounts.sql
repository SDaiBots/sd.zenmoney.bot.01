-- Схема таблицы accounts для Supabase
-- Основана на анализе структуры счетов ZenMoney API

CREATE TABLE IF NOT EXISTS zm_accounts (
    -- Основные поля
    id UUID PRIMARY KEY,                    -- Уникальный идентификатор счета (UUID)
    user_id INTEGER NOT NULL,               -- ID пользователя в ZenMoney
    instrument_id INTEGER NOT NULL,         -- ID валюты (ссылка на таблицу instruments)
    type VARCHAR(20) NOT NULL,              -- Тип счета: debt, checking, ccard, cash, deposit
    title VARCHAR(255) NOT NULL,            -- Название счета
    
    -- Финансовые данные
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,  -- Текущий баланс
    start_balance DECIMAL(15,2) NOT NULL DEFAULT 0,  -- Начальный баланс
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0,   -- Кредитный лимит
    
    -- Настройки счета
    in_balance BOOLEAN NOT NULL DEFAULT true,        -- Учитывать в общем балансе
    private BOOLEAN NOT NULL DEFAULT false,          -- Приватный счет
    savings BOOLEAN NOT NULL DEFAULT false,          -- Сберегательный счет
    archive BOOLEAN NOT NULL DEFAULT false,          -- Архивный счет
    enable_correction BOOLEAN NOT NULL DEFAULT true, -- Разрешена коррекция баланса
    enable_sms BOOLEAN NOT NULL DEFAULT false,       -- SMS уведомления
    
    -- Коррекция баланса
    balance_correction_type VARCHAR(20),    -- Тип коррекции: request, auto
    
    -- Депозитные параметры (для депозитов)
    capitalization BOOLEAN,                 -- Капитализация процентов
    percent DECIMAL(5,2),                   -- Процентная ставка
    start_date DATE,                        -- Дата начала депозита
    end_date_offset INTEGER,                -- Смещение даты окончания
    end_date_offset_interval VARCHAR(20),   -- Интервал смещения: day, month, year
    
    -- Параметры погашения (для кредитов)
    payoff_step DECIMAL(15,2),              -- Шаг погашения
    payoff_interval VARCHAR(20),            -- Интервал погашения
    
    -- Связи
    company_id INTEGER,                     -- ID компании (если корпоративный счет)
    role VARCHAR(50),                       -- Роль счета
    
    -- Синхронизация
    sync_id TEXT,                           -- ID для синхронизации
    changed BIGINT NOT NULL,                -- Timestamp последнего изменения
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_zm_accounts_user_id ON zm_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_zm_accounts_type ON zm_accounts(type);
CREATE INDEX IF NOT EXISTS idx_zm_accounts_instrument_id ON zm_accounts(instrument_id);
CREATE INDEX IF NOT EXISTS idx_zm_accounts_archive ON zm_accounts(archive);
CREATE INDEX IF NOT EXISTS idx_zm_accounts_changed ON zm_accounts(changed);

-- Комментарии к таблице и полям
COMMENT ON TABLE zm_accounts IS 'Счета пользователей из ZenMoney';
COMMENT ON COLUMN zm_accounts.id IS 'Уникальный идентификатор счета (UUID из ZenMoney)';
COMMENT ON COLUMN zm_accounts.user_id IS 'ID пользователя в системе ZenMoney';
COMMENT ON COLUMN zm_accounts.instrument_id IS 'ID валюты (ссылка на таблицу instruments)';
COMMENT ON COLUMN zm_accounts.type IS 'Тип счета: debt (долги), checking (расчетный), ccard (кредитная карта), cash (наличные), deposit (депозит)';
COMMENT ON COLUMN zm_accounts.balance IS 'Текущий баланс счета';
COMMENT ON COLUMN zm_accounts.start_balance IS 'Начальный баланс при создании счета';
COMMENT ON COLUMN zm_accounts.credit_limit IS 'Кредитный лимит (для кредитных карт)';
COMMENT ON COLUMN zm_accounts.in_balance IS 'Учитывать ли счет в общем балансе пользователя';
COMMENT ON COLUMN zm_accounts.private IS 'Приватный счет (не отображается в общих отчетах)';
COMMENT ON COLUMN zm_accounts.savings IS 'Сберегательный счет';
COMMENT ON COLUMN zm_accounts.archive IS 'Архивный счет (неактивный)';
COMMENT ON COLUMN zm_accounts.enable_correction IS 'Разрешена ли коррекция баланса';
COMMENT ON COLUMN zm_accounts.enable_sms IS 'Включены ли SMS уведомления';
COMMENT ON COLUMN zm_accounts.balance_correction_type IS 'Тип коррекции баланса: request (по запросу), auto (автоматически)';
COMMENT ON COLUMN zm_accounts.capitalization IS 'Капитализация процентов (для депозитов)';
COMMENT ON COLUMN zm_accounts.percent IS 'Процентная ставка (для депозитов и кредитов)';
COMMENT ON COLUMN zm_accounts.start_date IS 'Дата начала (для депозитов)';
COMMENT ON COLUMN zm_accounts.end_date_offset IS 'Смещение даты окончания в днях/месяцах/годах';
COMMENT ON COLUMN zm_accounts.end_date_offset_interval IS 'Единица измерения смещения: day, month, year';
COMMENT ON COLUMN zm_accounts.payoff_step IS 'Размер шага погашения (для кредитов)';
COMMENT ON COLUMN zm_accounts.payoff_interval IS 'Интервал погашения: day, month, year';
COMMENT ON COLUMN zm_accounts.company_id IS 'ID компании (для корпоративных счетов)';
COMMENT ON COLUMN zm_accounts.role IS 'Роль счета в системе';
COMMENT ON COLUMN zm_accounts.sync_id IS 'ID для синхронизации с внешними системами';
COMMENT ON COLUMN zm_accounts.changed IS 'Unix timestamp последнего изменения в ZenMoney';

-- Триггер для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_zm_accounts_updated_at 
    BEFORE UPDATE ON zm_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
