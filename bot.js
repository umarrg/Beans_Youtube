require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const xml2js = require('xml2js');

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text({ type: 'application/atom+xml' }));

const bot = new TelegramBot(process.env.TOKEN, { polling: true });
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;
const CALLBACK_URL = 'https://995f-197-211-58-96.ngrok-free.app/notifications';

let userChatIds = [];

function subscribe() {
    const hubUrl = 'https://pubsubhubbub.appspot.com/subscribe';
    const topicUrl = `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

    const callbackUrl = CALLBACK_URL;

    const params = new URLSearchParams();
    params.append('hub.mode', 'subscribe');
    params.append('hub.topic', topicUrl);
    params.append('hub.callback', callbackUrl);
    params.append('hub.verify', 'async');

    axios.post(hubUrl, params)
        .then(response => {
            console.log('Subscription request sent.');
        })
        .catch(error => {
            console.error('Error subscribing to YouTube notifications:', error.response.data);
        });
}

app.get('/notifications', (req, res) => {
    const hubMode = req.query['hub.mode'];
    const hubChallenge = req.query['hub.challenge'];

    if (hubMode === 'subscribe') {
        console.log('Subscription verified.');
        res.status(200).send(hubChallenge);
    } else {
        res.status(400).send('Bad Request');
    }
});

app.post('/notifications', (req, res) => {
    const xml = req.body;

    xml2js.parseString(xml, (err, result) => {
        if (err) {
            console.error('Error parsing XML:', err);
            res.status(500).send('Internal Server Error');
            return;
        }
        try {
            const entry = result.feed.entry[0];
            const videoId = entry['yt:videoId'][0];
            const videoTitle = entry.title[0];
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            const message = `📹 New Video Posted: *${videoTitle}*\nWatch here: ${videoUrl}`;

            userChatIds.forEach(chatId => {
                bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            });

            console.log(`Forwarded video: ${videoTitle}`);

            res.status(200).send('OK');
        } catch (e) {
            console.error('Error processing notification:', e);
            res.status(500).send('Internal Server Error');
        }
    });
});

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

subscribe();

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
