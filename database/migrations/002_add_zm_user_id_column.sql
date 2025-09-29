-- =====================================================
-- Добавление колонки zm_user_id в таблицу users
-- =====================================================

-- Проверяем, существует ли колонка zm_user_id
DO $$
BEGIN
    -- Если колонка не существует, добавляем её
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'zm_user_id'
    ) THEN
        -- Добавляем колонку zm_user_id
        ALTER TABLE users 
        ADD COLUMN zm_user_id INTEGER;
        
        -- Добавляем комментарий к колонке
        COMMENT ON COLUMN users.zm_user_id IS 'ID пользователя в ZenMoney';
        
        RAISE NOTICE 'Колонка zm_user_id успешно добавлена в таблицу users';
    ELSE
        RAISE NOTICE 'Колонка zm_user_id уже существует в таблице users';
    END IF;
END $$;

-- Проверяем результат
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'zm_user_id';
