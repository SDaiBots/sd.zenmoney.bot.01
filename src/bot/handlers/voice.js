const axios = require('axios');
const { handleTransactionWithAI } = require('./messages');

/**
 * Функция скачивания голосового файла из Telegram
 */
async function downloadVoiceFile(bot, token, fileId) {
  try {
    console.log(`📥 Скачиваем голосовой файл: ${fileId}`);
    
    // Получаем информацию о файле
    const fileInfo = await bot.getFile(fileId);
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('Не удалось получить информацию о файле');
    }
    
    // Формируем URL для скачивания
    const fileUrl = `https://api.telegram.org/file/bot${token}/${fileInfo.file_path}`;
    
    // Скачиваем файл
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    
    console.log(`✅ Файл успешно скачан, размер: ${response.data.length} байт`);
    return response.data;
    
  } catch (error) {
    console.error('❌ Ошибка при скачивании голосового файла:', error.message);
    throw error;
  }
}

/**
 * Функция транскрибации голосового сообщения через OpenAI Whisper
 */
async function transcribeVoice(audioBuffer) {
  try {
    console.log('🎤 Начинаем транскрибацию голосового сообщения...');
    
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Создаем File объект для OpenAI API
    const audioFile = new File([audioBuffer], 'voice.ogg', {
      type: 'audio/ogg'
    });
    
    // Отправляем запрос к Whisper API
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'ru', // Указываем русский язык для лучшего распознавания
      prompt: 'Транзакция расход доход сумма магазин продукты. Числа всегда пиши цифрами с пробелами: сто тысяч = 100 000, два миллиона = 2 000 000, тысяча сто = 1 100, пятьсот = 500, тысяча = 1 000, двадцать тысяч = 20 000'
    });
    
    const transcribedText = response.text.trim();
    console.log(`✅ Транскрибация завершена: "${transcribedText}"`);
    
    return transcribedText;
    
  } catch (error) {
    console.error('❌ Ошибка при транскрибации:', error.message);
    throw error;
  }
}

/**
 * Функция обработки голосового сообщения
 */
async function handleVoiceMessage(bot, supabaseClient, aiTagsStorage, token, chatId, voice, user, fullUserName, messageId, currentUser = null) {
  try {
    console.log(`🎤 Получено голосовое сообщение от пользователя ${fullUserName}`);
    
    // Отправляем сообщение о начале обработки
    const processingMessage = await bot.sendMessage(chatId, '🎤 Обрабатываю голосовое сообщение...', {
      reply_to_message_id: messageId
    });
    
    // Скачиваем аудиофайл
    const audioBuffer = await downloadVoiceFile(bot, token, voice.file_id);
    
    // Транскрибируем голос
    const transcribedText = await transcribeVoice(audioBuffer);
    
    // Удаляем сообщение о обработке
    await bot.deleteMessage(chatId, processingMessage.message_id);
    
    if (!transcribedText || transcribedText.trim() === '') {
      await bot.sendMessage(chatId, '❌ Не удалось распознать речь в голосовом сообщении. Попробуйте еще раз.', {
        reply_to_message_id: messageId
      });
      return;
    }
    
    // Отправляем сообщение с результатом транскрибации
    await bot.sendMessage(chatId, `🎤 *Распознанный текст:*\n"${transcribedText}"`, { 
      parse_mode: 'Markdown',
      reply_to_message_id: messageId
    });
    
    // Обрабатываем транскрибированный текст как голосовое сообщение
    await handleTransactionWithAI(bot, supabaseClient, aiTagsStorage, chatId, transcribedText, user, fullUserName, true, messageId, currentUser);
    
  } catch (error) {
    console.error('❌ Ошибка при обработке голосового сообщения:', error.message);
    
    // Отправляем сообщение об ошибке
    let errorMessage = '❌ Ошибка при обработке голосового сообщения.';
    
    if (error.message.includes('timeout')) {
      errorMessage = '⏱️ Время обработки голосового сообщения истекло. Попробуйте отправить более короткое сообщение.';
    } else if (error.message.includes('API key')) {
      errorMessage = '🔑 Ошибка API ключа OpenAI. Обратитесь к администратору.';
    } else if (error.message.includes('file')) {
      errorMessage = '📁 Ошибка при скачивании голосового файла. Попробуйте еще раз.';
    }
    
    await bot.sendMessage(chatId, errorMessage, {
      reply_to_message_id: messageId
    });
  }
}

module.exports = {
  handleVoiceMessage,
  downloadVoiceFile,
  transcribeVoice
};
