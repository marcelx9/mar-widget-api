const express = require("express");
require("dotenv").config();

const { getLastFmStats } = require("./lastfm");
const { getTrackImage, getArtistImage, getAlbumImage, getLikedSongsCount } = require("./spotify");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

async function getMusicStats() {
    const lastfm = await getLastFmStats();

    let topAlbumImage = lastfm.top_album_image_fallback;
    let lastSongImage = lastfm.last_song_image_fallback;
    let topArtistImage = null;
    let topSongImage = lastfm.top_song_image_fallback;
    let likedSongs = 0;

    try {
        likedSongs = await getLikedSongsCount();
    } catch {}


    try {
        lastSongImage = await getTrackImage(lastfm.last_song, lastfm.last_artist);
    } catch {}

    try {
        topAlbumImage = await getAlbumImage(lastfm.top_album, lastfm.top_album_artist);
    } catch {}

    try {
        topArtistImage = await getArtistImage(lastfm.top_artist);
    } catch {}

    try {
        topSongImage = await getTrackImage(lastfm.top_song, lastfm.top_song_artist);
    } catch {}

    return {
        last_song: lastfm.last_song,
        last_artist: lastfm.last_artist,
        last_song_image: lastSongImage,
        liked_songs: likedSongs,
        liked_songs_text: `${likedSongs.toLocaleString("en-US")} liked songs`,
        top_album: lastfm.top_album,
        top_album_artist: lastfm.top_album_artist,
        top_album_image: topAlbumImage,
        top_album_playcount: lastfm.top_album_playcount,

        last_album: lastfm.last_album,
        last_album_image: lastSongImage,

        top_artist: lastfm.top_artist,
        top_artist_image: topArtistImage,
        top_artist_playcount: lastfm.top_artist_playcount,

        top_song: lastfm.top_song,
        top_song_artist: lastfm.top_song_artist,
        top_song_image: topSongImage,
        top_song_playcount: lastfm.top_song_playcount,

        scrobbles: lastfm.scrobbles,
    };
}

app.get("/", (req, res) => {
    res.send("Servidor del widget funcionando.");
});

app.get("/music", async (req, res) => {
    try {
        const stats = await getMusicStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.response?.data || err.message,
        });
    }
});

function buildDiscordPayload(stats) {
    return {
        data: {
            dynamic: [
                {
                    type: 1,
                    name: "last_song",
                    value: `${stats.last_song} · ${stats.last_artist}`,
                },
                { type: 1, name: "last_artist", value: String(stats.last_artist) },
                {
                    type: 3,
                    name: "last_song_image",
                    value: { url: String(stats.last_song_image) },
                },

                {
                    type: 1,
                    name: "liked_songs",
                    value: String(stats.liked_songs_text),
                },

                { type: 1, name: "top_artist", value: String(stats.top_artist) },
                {
                    type: 3,
                    name: "top_artist_image",
                    value: { url: String(stats.top_artist_image) },
                },

                { type: 1, name: "last_album", value: String(stats.last_album) },
                {
                    type: 3,
                    name: "last_album_image",
                    value: { url: String(stats.last_album_image) },
                },

                { type: 1, name: "top_album", value: String(stats.top_album) },
                { type: 1, name: "top_album_artist", value: String(stats.top_album_artist) },
                {
                    type: 3,
                    name: "top_album_image",
                    value: { url: String(stats.top_album_image) },
                },
                { type: 1, name: "top_album_playcount", value: String(stats.top_album_playcount) },

                { type: 1, name: "top_artist_playcount", value: String(stats.top_artist_playcount) },

                {
                    type: 1,
                    name: "top_song",
                    value: `${stats.top_song} · ${stats.top_song_artist}`,
                },
                { type: 1, name: "top_song_artist", value: String(stats.top_song_artist) },
                {
                    type: 3,
                    name: "top_song_image",
                    value: { url: String(stats.top_song_image) },
                },
                { type: 1, name: "top_song_playcount", value: String(stats.top_song_playcount) },

                { type: 1, name: "scrobbles", value: String(stats.scrobbles) },
            ],
            primary: {
                top_artist: String(stats.top_artist),
            },
        },
    };
}

app.get("/update-widget", async (req, res) => {
    try {
        if (!process.env.DISCORD_APP_ID || !process.env.DISCORD_USER_ID || !process.env.DISCORD_BOT_TOKEN) {
            throw new Error("Faltan variables de Discord en .env");
        }

        const stats = await getMusicStats();
        const payload = buildDiscordPayload(stats);

        const url = `https://discord.com/api/v9/applications/${process.env.DISCORD_APP_ID}/users/${process.env.DISCORD_USER_ID}/identities/0/profile`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const text = await response.text();

        let discord;
        try {
            discord = text ? JSON.parse(text) : null;
        } catch {
            discord = text;
        }

        res.json({
            success: response.ok,
            status: response.status,
            sent: payload,
            discord,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.response?.data || err.message,
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor iniciado en puerto ${PORT}`);
    console.log(`Music: http://localhost:${PORT}/music`);
    console.log(`Update widget: http://localhost:${PORT}/update-widget`);
});