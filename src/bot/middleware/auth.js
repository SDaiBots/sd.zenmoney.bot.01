/**
 * Функция проверки авторизации пользователя
 */
async function isUserAuthorized(supabaseClient, telegramId, username) {
  try {
    if (!supabaseClient) {
      console.warn('⚠️ Supabase клиент не инициализирован');
      return { authorized: false, user: null };
    }

    const authResult = await supabaseClient.isUserAuthorized(telegramId, username);
    return authResult;

  } catch (error) {
    console.error('❌ Ошибка при проверке авторизации:', error.message);
    return { authorized: false, user: null };
  }
}

/**
 * Функция проверки разрешенного пользователя (устаревшая, используется для совместимости)
 */
async function isUserAllowed(supabaseClient, userId, username) {
  try {
    if (!supabaseClient) {
      console.warn('⚠️ Supabase клиент не инициализирован, разрешаем всем пользователям');
      return true;
    }

    // Получаем настройку 'user' из Supabase
    const userSettingResult = await supabaseClient.getSetting('user');
    
    if (!userSettingResult.success || !userSettingResult.value) {
      console.warn('⚠️ Настройка "user" не найдена или пуста, разрешаем всем пользователям');
      return true;
    }

    const allowedUser = userSettingResult.value.trim();
    const currentUserId = userId.toString();
    const currentUsername = username || '';

    // Проверяем по ID пользователя или username
    const isAllowed = currentUserId === allowedUser || currentUsername === allowedUser;
    
    if (!isAllowed) {
      console.log(`🚫 Доступ запрещен для пользователя: ID=${currentUserId}, username=${currentUsername}`);
      console.log(`🔒 Разрешенный пользователь: ${allowedUser}`);
    } else {
      console.log(`✅ Доступ разрешен для пользователя: ID=${currentUserId}, username=${currentUsername}`);
    }

    return isAllowed;

  } catch (error) {
    console.error('❌ Ошибка при проверке пользователя:', error.message);
    // В случае ошибки разрешаем доступ для безопасности
    return true;
  }
}

module.exports = {
  isUserAuthorized,
  isUserAllowed
};
