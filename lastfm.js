const axios = require("axios");

const lastfm = axios.create({
    baseURL: "https://ws.audioscrobbler.com/2.0/",
});

function getLastFmImage(images) {
    const url =
        images?.find((img) => img.size === "extralarge")?.["#text"] ||
        images?.find((img) => img.size === "large")?.["#text"] ||
        images?.find((img) => img.size === "medium")?.["#text"] ||
        images?.find((img) => img.size === "small")?.["#text"] ||
        images?.find((img) => img?.["#text"])?.["#text"] ||
        null;

    return url && url.startsWith("http") ? url : null;
}

async function getLastFmStats() {
    if (!process.env.LASTFM_API_KEY || !process.env.LASTFM_USER) {
        throw new Error("Faltan LASTFM_API_KEY o LASTFM_USER en .env");
    }

    const recentResponse = await lastfm.get("/", {
        params: {
            method: "user.getrecenttracks",
            user: process.env.LASTFM_USER,
            api_key: process.env.LASTFM_API_KEY,
            format: "json",
            limit: 1,
        },
    });

    const topArtistsResponse = await lastfm.get("/", {
        params: {
            method: "user.gettopartists",
            user: process.env.LASTFM_USER,
            api_key: process.env.LASTFM_API_KEY,
            format: "json",
            period: "7day",
            limit: 1,
        },
    });

    const topTracksResponse = await lastfm.get("/", {
        params: {
            method: "user.gettoptracks",
            user: process.env.LASTFM_USER,
            api_key: process.env.LASTFM_API_KEY,
            format: "json",
            period: "7day",
            limit: 1,
        },
    });

    const topAlbumsResponse = await lastfm.get("/", {
        params: {
            method: "user.gettopalbums",
            user: process.env.LASTFM_USER,
            api_key: process.env.LASTFM_API_KEY,
            format: "json",
            period: "7day",
            limit: 1,
        },
    });

    const userInfoResponse = await lastfm.get("/", {
        params: {
            method: "user.getinfo",
            user: process.env.LASTFM_USER,
            api_key: process.env.LASTFM_API_KEY,
            format: "json",
        },
    });

    const recentTrack = recentResponse.data.recenttracks?.track?.[0];
    const topArtist = topArtistsResponse.data.topartists?.artist?.[0];
    const topTrack = topTracksResponse.data.toptracks?.track?.[0];
    const topAlbum = topAlbumsResponse.data.topalbums?.album?.[0];
    const userInfo = userInfoResponse.data.user;

    const lastSongImage = getLastFmImage(recentTrack?.image);
    const topAlbumImage = getLastFmImage(topAlbum?.image);
    const topSongImage = getLastFmImage(topTrack?.image);

    return {
        last_song: recentTrack?.name || "Unknown",
        last_artist: recentTrack?.artist?.["#text"] || "Unknown",
        last_song_image_fallback: lastSongImage,

        top_album: topAlbum?.name || "Unknown",
        top_album_artist: topAlbum?.artist?.name || "Unknown",
        top_album_playcount: topAlbum?.playcount || "0",
        top_album_image_fallback: topAlbumImage,

        top_artist: topArtist?.name || "Unknown",
        top_artist_playcount: topArtist?.playcount || "0",

        last_album: recentTrack?.album?.["#text"] || "Unknown",

        top_song: topTrack?.name || "Unknown",
        top_song_artist: topTrack?.artist?.name || "Unknown",
        top_song_playcount: topTrack?.playcount || "0",
        top_song_image_fallback: topSongImage,

        scrobbles: userInfo?.playcount || "0",
    };
}

module.exports = {
    getLastFmStats,
};