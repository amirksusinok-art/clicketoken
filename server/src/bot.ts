import { Bot, InlineKeyboard } from 'grammy';
import dotenv from 'dotenv';
import { checkFullFarmsAndNotify } from './db.js';

dotenv.config();

let botInstance: Bot | null = null;

export function getBot(): Bot | null {
  return botInstance;
}

export async function sendPushNotification(
  userId: number,
  text: string,
  buttonText: string = '🪙 Открыть кликер'
) {
  if (!botInstance) return;
  try {
    const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173';
    const keyboard = new InlineKeyboard().webApp(buttonText, webAppUrl);
    await botInstance.api.sendMessage(userId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } catch (err) {
    // Silently ignore if blocked or cannot send
  }
}

export async function notifyStorageFull(userId: number) {
  await sendPushNotification(
    userId,
    `🏭 **Ваша ферма видеокарт заполнилась на 100%!** Токены больше не майнятся. Зайдите и заберите прибыль, чтобы запустить добычу заново!`,
    '🪙 Забрать прибыль'
  );
}

export async function notifyReferralEarning(referrerId: number, friendName: string, amount: number) {
  const formatted = amount >= 1 ? amount.toFixed(1) : amount.toFixed(3);
  await sendPushNotification(
    referrerId,
    `💸 **Твой друг ${friendName} только что накликал монет** — тебе в реферальный сейф капнуло +${formatted} Т!`,
    '🪙 Открыть сейф'
  );
}

export async function notifyPvpWin(winnerId: number, amount: number) {
  const formatted = amount >= 1 ? amount.toFixed(1) : amount.toFixed(2);
  await sendPushNotification(
    winnerId,
    `🏆 **Твой соперник прокрутил колесо!** Ты победил и получил +${formatted} Т на баланс!`,
    '🪙 Открыть кликер'
  );
}

export function setupTelegramBot(): Bot | null {
  const token = process.env.BOT_TOKEN;
  if (!token || token.trim() === '') {
    console.log('ℹ️ BOT_TOKEN не задан. Бот отключён, сервер работает в автономном Dev-режиме.');
    return null;
  }

  const webAppUrl = process.env.WEBAPP_URL || 'http://localhost:5173';

  try {
    const bot = new Bot(token);
    botInstance = bot;

    // Start command: simple welcome message with button per user request
    bot.command('start', async (ctx) => {
      const keyboard = new InlineKeyboard().webApp('🪙 Открыть кликер', webAppUrl);

      await ctx.reply('Добро пожаловать в токен кликер', {
        reply_markup: keyboard,
      });
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

    // Start background monitor for full farm storage (runs every 60s)
    setInterval(() => {
      try {
        checkFullFarmsAndNotify((fullUserId) => {
          notifyStorageFull(fullUserId);
        });
      } catch (err) {
        console.error('Ошибка проверки заполнения фермы:', err);
      }
    }, 60_000);

    return bot;
  } catch (err) {
    console.error('Не удалось инициализировать Telegram-бота:', err);
    return null;
  }
}
