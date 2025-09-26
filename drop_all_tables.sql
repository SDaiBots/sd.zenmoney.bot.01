-- Скрипт для удаления всех таблиц ZenMoney Bot из Supabase
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные! Используйте с осторожностью!

-- Отключаем проверку внешних ключей для безопасного удаления
SET session_replication_role = replica;

-- Удаление представлений (views) - только если они существуют
DO $$
BEGIN
    -- Удаляем представления
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'active_zm_tags') THEN
        DROP VIEW active_zm_tags CASCADE;
        RAISE NOTICE 'Представление active_zm_tags удалено';
    ELSE
        RAISE NOTICE 'Представление active_zm_tags не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'zm_tags_with_parent') THEN
        DROP VIEW zm_tags_with_parent CASCADE;
        RAISE NOTICE 'Представление zm_tags_with_parent удалено';
    ELSE
        RAISE NOTICE 'Представление zm_tags_with_parent не существует';
    END IF;
END $$;

-- Удаление функций - только если они существуют
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_child_tags') THEN
        DROP FUNCTION get_child_tags(UUID) CASCADE;
        RAISE NOTICE 'Функция get_child_tags удалена';
    ELSE
        RAISE NOTICE 'Функция get_child_tags не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_parent_tags') THEN
        DROP FUNCTION get_parent_tags(UUID) CASCADE;
        RAISE NOTICE 'Функция get_parent_tags удалена';
    ELSE
        RAISE NOTICE 'Функция get_parent_tags не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_updated_at_column') THEN
        DROP FUNCTION update_updated_at_column() CASCADE;
        RAISE NOTICE 'Функция update_updated_at_column удалена';
    ELSE
        RAISE NOTICE 'Функция update_updated_at_column не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_zm_tags_updated_at') THEN
        DROP FUNCTION update_zm_tags_updated_at() CASCADE;
        RAISE NOTICE 'Функция update_zm_tags_updated_at удалена';
    ELSE
        RAISE NOTICE 'Функция update_zm_tags_updated_at не существует';
    END IF;
END $$;

-- Удаление триггеров - только если они существуют
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_zm_accounts_updated_at') THEN
        DROP TRIGGER update_zm_accounts_updated_at ON zm_accounts CASCADE;
        RAISE NOTICE 'Триггер update_zm_accounts_updated_at удален';
    ELSE
        RAISE NOTICE 'Триггер update_zm_accounts_updated_at не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'trigger_update_zm_tags_updated_at') THEN
        DROP TRIGGER trigger_update_zm_tags_updated_at ON zm_tags CASCADE;
        RAISE NOTICE 'Триггер trigger_update_zm_tags_updated_at удален';
    ELSE
        RAISE NOTICE 'Триггер trigger_update_zm_tags_updated_at не существует';
    END IF;
END $$;

-- Удаление таблиц - только если они существуют
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zm_accounts') THEN
        DROP TABLE zm_accounts CASCADE;
        RAISE NOTICE 'Таблица zm_accounts удалена';
    ELSE
        RAISE NOTICE 'Таблица zm_accounts не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zm_tags') THEN
        DROP TABLE zm_tags CASCADE;
        RAISE NOTICE 'Таблица zm_tags удалена';
    ELSE
        RAISE NOTICE 'Таблица zm_tags не существует';
    END IF;
    
    -- Также проверяем старые названия таблиц
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'accounts') THEN
        DROP TABLE accounts CASCADE;
        RAISE NOTICE 'Таблица accounts (старое название) удалена';
    ELSE
        RAISE NOTICE 'Таблица accounts не существует';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zenmoney_tags') THEN
        DROP TABLE zenmoney_tags CASCADE;
        RAISE NOTICE 'Таблица zenmoney_tags (старое название) удалена';
    ELSE
        RAISE NOTICE 'Таблица zenmoney_tags не существует';
    END IF;
END $$;

-- Включаем обратно проверку внешних ключей
SET session_replication_role = DEFAULT;

-- Выводим сообщение об успешном завершении
DO $$
BEGIN
    RAISE NOTICE 'Скрипт удаления таблиц завершен!';
    RAISE NOTICE 'Проверены и удалены (если существовали):';
    RAISE NOTICE '- Таблицы: zm_accounts, zm_tags, accounts, zenmoney_tags';
    RAISE NOTICE '- Представления: active_zm_tags, zm_tags_with_parent';
    RAISE NOTICE '- Функции: get_child_tags, get_parent_tags, update_updated_at_column, update_zm_tags_updated_at';
    RAISE NOTICE '- Триггеры: update_zm_accounts_updated_at, trigger_update_zm_tags_updated_at';
END $$;
