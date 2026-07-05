const axios = require("axios");
const querystring = require("querystring");

let cachedToken = null;
let tokenExpiresAt = 0;

const imageCache = new Map();
const CACHE_TIME = 10 * 60 * 1000;

function cacheKey(type, ...parts) {
    return `${type}:${parts.join(":").toLowerCase()}`;
}

function getCached(key) {
    const item = imageCache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
        imageCache.delete(key);
        return null;
    }

    return item.value;
}

function setCached(key, value) {
    imageCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TIME,
    });
}

async function getSpotifyAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const response = await axios.post(
        "https://accounts.spotify.com/api/token",
        querystring.stringify({
            grant_type: "refresh_token",
            refresh_token: process.env.SPOTIFY_REFRESH_TOKEN,
        }),
        {
            headers: {
                Authorization:
                    "Basic " +
                    Buffer.from(
                        process.env.SPOTIFY_CLIENT_ID +
                        ":" +
                        process.env.SPOTIFY_CLIENT_SECRET
                    ).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    cachedToken = response.data.access_token;
    tokenExpiresAt = Date.now() + 50 * 60 * 1000;

    return cachedToken;
}

function getBestImage(images) {
    if (!Array.isArray(images) || images.length === 0) return null;

    return (
        images.find((img) => img.width >= 600)?.url ||
        images[0]?.url ||
        null
    );
}

function cleanText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/\bfeat\.?\b/g, "")
        .replace(/\bft\.?\b/g, "")
        .replace(/\bwith\b.+/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function spotifySearch(type, query, limit = 5) {
    const token = await getSpotifyAccessToken();

    try {
        const response = await axios.get("https://api.spotify.com/v1/search", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                q: query,
                type,
                limit,
                market: "US",
            },
        });

        return response.data;
    } catch (err) {
        if (err.response?.status === 429) {
            console.error(
                `Spotify rate limit. Retry-After: ${err.response.headers?.["retry-after"] || "unknown"}s`
            );
            return null;
        }

        console.error("Spotify search error:", err.response?.data || err.message);
        return null;
    }
}

async function getTrackImage(song, artist) {
    const key = cacheKey("track", song, artist);
    const cached = getCached(key);
    if (cached !== null) return cached;

    const songClean = cleanText(song);
    const artistClean = cleanText(artist);

    const query = `${song} ${artist}`;
    const data = await spotifySearch("track", query, 5);

    const items = data?.tracks?.items || [];

    const exact = items.find((track) => {
        const trackName = cleanText(track.name);
        const artists = track.artists || [];

        return (
            trackName === songClean &&
            artists.some((a) => cleanText(a.name) === artistClean)
        );
    });

    const sameArtist = items.find((track) =>
        track.artists?.some((a) => cleanText(a.name) === artistClean)
    );

    const result =
        exact ||
        sameArtist ||
        items.find((track) => track.album?.images?.length) ||
        items[0];

    const image = getBestImage(result?.album?.images);

    setCached(key, image || "");
    return image;
}

async function getArtistImage(artist) {
    const key = cacheKey("artist", artist);
    const cached = getCached(key);
    if (cached !== null) return cached;

    const artistClean = cleanText(artist);

    const data = await spotifySearch("artist", artist, 5);
    const items = data?.artists?.items || [];

    const exact = items.find(
        (item) => cleanText(item.name) === artistClean
    );

    const result =
        exact ||
        items.find((item) => item.images?.length) ||
        items[0];

    const image = getBestImage(result?.images);

    setCached(key, image || "");
    return image;
}

async function getAlbumImage(album, artist) {
    const key = cacheKey("album", album, artist);
    const cached = getCached(key);
    if (cached !== null) return cached;

    const albumClean = cleanText(album);
    const artistClean = cleanText(artist);

    const query = `${album} ${artist}`;
    const data = await spotifySearch("album", query, 5);

    const items = data?.albums?.items || [];

    const exact = items.find((item) => {
        const albumName = cleanText(item.name);
        const artists = item.artists || [];

        return (
            albumName === albumClean &&
            artists.some((a) => cleanText(a.name) === artistClean)
        );
    });

    const sameArtist = items.find((item) =>
        item.artists?.some((a) => cleanText(a.name) === artistClean)
    );

    const result =
        exact ||
        sameArtist ||
        items.find((item) => item.images?.length) ||
        items[0];

    const image = getBestImage(result?.images);

    setCached(key, image || "");
    return image;
}

async function getLikedSongsCount() {
    const token = await getSpotifyAccessToken();

    try {
        const response = await axios.get("https://api.spotify.com/v1/me/tracks", {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            params: {
                limit: 1,
            },
        });

        return response.data.total;
    } catch (err) {
        if (err.response?.status === 429) {
            console.error(
                `Spotify liked songs rate limit. Retry-After: ${err.response.headers?.["retry-after"] || "unknown"}s`
            );
            return 0;
        }

        console.error("Spotify liked songs error:", err.response?.data || err.message);
        return 0;
    }
}

module.exports = {
    getTrackImage,
    getArtistImage,
    getAlbumImage,
    getLikedSongsCount,
};