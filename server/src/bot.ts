import { Bot, InlineKeyboard } from 'grammy';
import dotenv from 'dotenv';
dotenv.config();

export function setupTelegramBot(): Bot | null {
  const token = process.env.BOT_TOKEN;
  if (!token || token.trim() === '') {
    console.log('ℹ️ BOT_TOKEN не задан. Бот отключён, сервер работает в автономном Dev-режиме.');
    return null;
  }

  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173';

  try {
    const bot = new Bot(token);

    bot.command('start', async (ctx) => {
      const keyboard = new InlineKeyboard().webApp('🪙 Запустить игру Токен', webAppUrl);

      await ctx.reply(
        `👋 **Добро пожаловать в кликер «Токен»!**\n\n` +
        `🪙 Тапайте по интерактивной монете и накапливайте Токены.\n` +
        `⚡ Прокачивайте доход за клик в **Upgrader**.\n` +
        `🎮 Участвуйте в 4 мини-играх: **Crash**, **Самолётик**, **Random**, **Больше/Меньше**.\n` +
        `💸 Переводите Токены друзьям по @username.\n` +
        `🔒 Все исходы 100% прозрачны и защищены технологией **Provably Fair** (SHA-256).\n\n` +
        `Нажмите кнопку ниже, чтобы открыть Mini App:`,
        {
          parse_mode: 'Markdown',
          reply_markup: keyboard,
        }
      );
    });

    bot.catch((err) => {
      console.error('Ошибка в Telegram-боте:', err);
    });

    // Start bot in background
    bot.start({
      onStart: (botInfo) => {
        console.log(`🤖 Telegram-бот @${botInfo.username} успешно запущен!`);
      },
    });

    return bot;
  } catch (err) {
    console.error('Не удалось инициализировать Telegram-бота:', err);
    return null;
  }
}
