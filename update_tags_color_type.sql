-- Обновление типа поля color в таблице zm_tags
-- Изменение с INTEGER на BIGINT для поддержки больших значений цветов

-- Удаляем представления, которые зависят от поля color
DROP VIEW IF EXISTS active_zm_tags;
DROP VIEW IF EXISTS zm_tags_with_parent;

-- Изменяем тип поля color с INTEGER на BIGINT
ALTER TABLE zm_tags 
ALTER COLUMN color TYPE BIGINT;

-- Обновляем ограничение для поля color
ALTER TABLE zm_tags 
DROP CONSTRAINT IF EXISTS valid_color;

ALTER TABLE zm_tags 
ADD CONSTRAINT valid_color CHECK (color >= 0 AND color <= 18446744073709551615);

-- Обновляем комментарий
COMMENT ON COLUMN zm_tags.color IS 'Цвет тега в числовом формате (ARGB, BIGINT для больших значений)';

-- Пересоздаем представления
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
