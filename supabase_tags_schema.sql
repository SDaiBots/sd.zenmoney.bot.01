-- Схема таблицы для тегов (статей) ZenMoney в Supabase
-- Создано на основе анализа API ZenMoney

-- Создание таблицы тегов
CREATE TABLE IF NOT EXISTS zm_tags (
    -- Основные поля
    id UUID PRIMARY KEY,                    -- Уникальный идентификатор тега (из ZenMoney)
    user_id INTEGER NOT NULL,               -- ID пользователя ZenMoney
    title TEXT NOT NULL,                    -- Название тега/статьи
    parent_id UUID REFERENCES zm_tags(id), -- ID родительского тега (для иерархии)
    
    -- Визуальные настройки
    color BIGINT,                           -- Цвет тега (числовое представление)
    icon TEXT,                              -- Иконка тега
    picture TEXT,                           -- Изображение тега (может быть null)
    
    -- Настройки отображения
    show_income BOOLEAN DEFAULT false,      -- Показывать в доходах
    show_outcome BOOLEAN DEFAULT true,      -- Показывать в расходах
    budget_income BOOLEAN DEFAULT false,    -- Учитывать в бюджете доходов
    budget_outcome BOOLEAN DEFAULT false,   -- Учитывать в бюджете расходов
    
    -- Статус и системные поля
    required BOOLEAN DEFAULT false,         -- Обязательный тег
    archive BOOLEAN DEFAULT false,          -- Архивный статус
    static_id TEXT,                         -- Статический ID (может быть null)
    
    -- Временные метки
    changed TIMESTAMP WITH TIME ZONE,       -- Время последнего изменения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Индексы для оптимизации
    CONSTRAINT unique_zm_tag_id UNIQUE (id),
    CONSTRAINT valid_color CHECK (color >= 0 AND color <= 18446744073709551615)
);

-- Создание индексов для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_zm_tags_user_id ON zm_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_zm_tags_parent_id ON zm_tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_zm_tags_title ON zm_tags(title);
CREATE INDEX IF NOT EXISTS idx_zm_tags_archive ON zm_tags(archive);
CREATE INDEX IF NOT EXISTS idx_zm_tags_show_income ON zm_tags(show_income);
CREATE INDEX IF NOT EXISTS idx_zm_tags_show_outcome ON zm_tags(show_outcome);
CREATE INDEX IF NOT EXISTS idx_zm_tags_changed ON zm_tags(changed);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_zm_tags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER trigger_update_zm_tags_updated_at
    BEFORE UPDATE ON zm_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_zm_tags_updated_at();

-- Комментарии к таблице и полям
COMMENT ON TABLE zm_tags IS 'Таблица тегов (статей) из ZenMoney API';
COMMENT ON COLUMN zm_tags.id IS 'Уникальный идентификатор тега из ZenMoney (UUID)';
COMMENT ON COLUMN zm_tags.user_id IS 'ID пользователя ZenMoney';
COMMENT ON COLUMN zm_tags.title IS 'Название тега/статьи';
COMMENT ON COLUMN zm_tags.parent_id IS 'ID родительского тега для создания иерархии';
COMMENT ON COLUMN zm_tags.color IS 'Цвет тега в числовом формате (ARGB, BIGINT для больших значений)';
COMMENT ON COLUMN zm_tags.icon IS 'Иконка тега (например: "2007_controller")';
COMMENT ON COLUMN zm_tags.picture IS 'Изображение тега (может быть null)';
COMMENT ON COLUMN zm_tags.show_income IS 'Показывать тег в разделе доходов';
COMMENT ON COLUMN zm_tags.show_outcome IS 'Показывать тег в разделе расходов';
COMMENT ON COLUMN zm_tags.budget_income IS 'Учитывать тег в бюджете доходов';
COMMENT ON COLUMN zm_tags.budget_outcome IS 'Учитывать тег в бюджете расходов';
COMMENT ON COLUMN zm_tags.required IS 'Обязательный тег (нельзя удалить)';
COMMENT ON COLUMN zm_tags.archive IS 'Архивный статус тега';
COMMENT ON COLUMN zm_tags.static_id IS 'Статический ID тега (может быть null)';
COMMENT ON COLUMN zm_tags.changed IS 'Время последнего изменения в ZenMoney';
COMMENT ON COLUMN zm_tags.created_at IS 'Время создания записи в Supabase';
COMMENT ON COLUMN zm_tags.updated_at IS 'Время последнего обновления записи в Supabase';

-- Представление для активных тегов (не архивных)
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

-- Представление для тегов с иерархией (с названием родительского тега)
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

-- Функция для получения всех дочерних тегов
CREATE OR REPLACE FUNCTION get_child_tags(parent_tag_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE tag_hierarchy AS (
        -- Базовый случай: родительский тег
        SELECT 
            t.id,
            t.title,
            0 as level
        FROM zm_tags t
        WHERE t.id = parent_tag_id
        
        UNION ALL
        
        -- Рекурсивный случай: дочерние теги
        SELECT 
            t.id,
            t.title,
            th.level + 1
        FROM zm_tags t
        JOIN tag_hierarchy th ON t.parent_id = th.id
        WHERE t.archive = false
    )
    SELECT 
        th.id,
        th.title,
        th.level
    FROM tag_hierarchy th
    WHERE th.id != parent_tag_id  -- Исключаем сам родительский тег
    ORDER BY th.level, th.title;
END;
$$ LANGUAGE plpgsql;

-- Функция для получения всех родительских тегов
CREATE OR REPLACE FUNCTION get_parent_tags(child_tag_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE tag_hierarchy AS (
        -- Базовый случай: дочерний тег
        SELECT 
            t.id,
            t.title,
            0 as level
        FROM zm_tags t
        WHERE t.id = child_tag_id
        
        UNION ALL
        
        -- Рекурсивный случай: родительские теги
        SELECT 
            t.id,
            t.title,
            th.level + 1
        FROM zm_tags t
        JOIN tag_hierarchy th ON t.id = th.parent_id
        WHERE t.archive = false
    )
    SELECT 
        th.id,
        th.title,
        th.level
    FROM tag_hierarchy th
    WHERE th.id != child_tag_id  -- Исключаем сам дочерний тег
    ORDER BY th.level DESC, th.title;
END;
$$ LANGUAGE plpgsql;
