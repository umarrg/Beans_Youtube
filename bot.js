require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cron = require('cron');

const app = express();

const bot = new TelegramBot(process.env.TOKEN, { polling: true });
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

let userChatIds = [];
let lastVideoId = null;

async function getLatestYouTubeVideo() {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${YOUTUBE_CHANNEL_ID}&order=date&maxResults=1&type=video&key=${YOUTUBE_API_KEY}`;

    try {
        const response = await axios.get(url);
        const video = response.data.items[0];
        const videoId = video.id.videoId;
        const videoTitle = video.snippet.title;
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        return {
            id: videoId,
            title: videoTitle,
            url: videoUrl,
        };
    } catch (error) {
        console.error('Error fetching YouTube video:', error.message);
        return null;
    }
}

async function forwardLatestVideo() {
    const video = await getLatestYouTubeVideo();

    if (video && video.id !== lastVideoId) {
        const message = `📹 New Video Posted: *${video.title}*\nWatch here: ${video.url}`;

        userChatIds.forEach(chatId => {
            bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
        });

        lastVideoId = video.id;
        console.log(`Forwarded video: ${video.title}`);
    } else {
        console.log('No new video to forward.');
    }
}

const videoCheckJob = new cron.CronJob('*/5 * * * *', () => {
    console.log('Checking for new YouTube video...');
    forwardLatestVideo();
});

videoCheckJob.start();

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    if (!userChatIds.includes(chatId)) {
        userChatIds.push(chatId);
        console.log(`Saved new user with chatId: ${chatId}`);
    }

    bot.sendMessage(chatId, "Welcome to the YouTube Forwarder Bot! This bot automatically forwards new videos from the YouTube channel to this Telegram chat.");
});

bot.on('polling_error', (error) => {
    console.log(`Polling error: ${error.code}`);
});

bot.on('message', (msg) => {
    console.log(msg);
});

app.get('/', (req, res) => {
    res.send('YouTube Forwarder Bot is running');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
