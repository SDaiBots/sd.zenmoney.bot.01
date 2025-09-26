-- Обновление типа поля color в таблице zm_tags
-- Изменение с INTEGER на BIGINT для поддержки больших значений цветов

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
