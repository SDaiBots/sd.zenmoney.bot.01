-- =====================================================
-- Исправление схемы для zm_tags и zm_accounts
-- Заменяем id на zm_tag_id/zm_account_id для избежания UUID конфликтов
-- =====================================================

-- 1. Исправляем схему zm_tags
DO $$
BEGIN
    -- Добавляем колонку zm_tag_id если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'zm_tags' 
        AND column_name = 'zm_tag_id'
    ) THEN
        ALTER TABLE zm_tags 
        ADD COLUMN zm_tag_id VARCHAR(255);
        
        RAISE NOTICE 'Колонка zm_tag_id добавлена в zm_tags';
    ELSE
        RAISE NOTICE 'Колонка zm_tag_id уже существует в zm_tags';
    END IF;
END $$;

-- Добавляем индекс для zm_tag_id
CREATE INDEX IF NOT EXISTS idx_zm_tags_zm_tag_id ON zm_tags(zm_tag_id);

-- Комментарий для zm_tag_id
COMMENT ON COLUMN zm_tags.zm_tag_id IS 'ID тега из ZenMoney API';

-- 2. Исправляем схему zm_accounts
DO $$
BEGIN
    -- Добавляем колонку zm_account_id если её нет
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'zm_accounts' 
        AND column_name = 'zm_account_id'
    ) THEN
        ALTER TABLE zm_accounts 
        ADD COLUMN zm_account_id VARCHAR(255);
        
        RAISE NOTICE 'Колонка zm_account_id добавлена в zm_accounts';
    ELSE
        RAISE NOTICE 'Колонка zm_account_id уже существует в zm_accounts';
    END IF;
END $$;

-- Добавляем индекс для zm_account_id
CREATE INDEX IF NOT EXISTS idx_zm_accounts_zm_account_id ON zm_accounts(zm_account_id);

-- Комментарий для zm_account_id
COMMENT ON COLUMN zm_accounts.zm_account_id IS 'ID счета из ZenMoney API';

-- Проверяем результат
SELECT 'zm_tags columns:' as table_name;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'zm_tags' 
ORDER BY ordinal_position;

SELECT 'zm_accounts columns:' as table_name;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'zm_accounts' 
ORDER BY ordinal_position;
