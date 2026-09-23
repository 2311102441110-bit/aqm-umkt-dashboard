const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

let bot = null;

if (token && token !== 'your_telegram_bot_token_here') {
    bot = new TelegramBot(token, { polling: false });
}

const sendAlert = async (message) => {
    if (bot && chatId && chatId !== 'your_telegram_chat_id_here') {
        try {
            await bot.sendMessage(
                chatId,
                `⚠️ *Peringatan Kualitas Udara*\n\n${message}`,
                {
                    parse_mode: 'Markdown'
                }
            );

            console.log('Telegram alert sent.');
        } catch (error) {
            console.error(
                'Error sending Telegram alert:',
                error.message
            );
        }
    } else {
        console.log(
            'Telegram alert skipped (not configured):',
            message
        );
    }
};

module.exports = {
    sendAlert
};