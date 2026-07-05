const axios = require("axios");

const imageCache = new Map();
const CACHE_TIME = 60 * 60 * 1000;

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
    if (!value) return;

    imageCache.set(key, {
        value,
        expiresAt: Date.now() + CACHE_TIME,
    });
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

function bestDeezerCover(album) {
    return (
        album?.cover_xl ||
        album?.cover_big ||
        album?.cover_medium ||
        album?.cover ||
        null
    );
}

async function getDeezerTrackImage(song, artist) {
    const key = cacheKey("track", song, artist);
    const cached = getCached(key);
    if (cached) return cached;

    try {
        const response = await axios.get("https://api.deezer.com/search", {
            params: {
                q: `${song} ${artist}`,
                limit: 10,
            },
        });

        const items = response.data?.data || [];
        const songClean = cleanText(song);
        const artistClean = cleanText(artist);

        const exact = items.find((item) => {
            return (
                cleanText(item.title) === songClean &&
                cleanText(item.artist?.name) === artistClean
            );
        });

        const sameArtist = items.find((item) => {
            return cleanText(item.artist?.name) === artistClean;
        });

        const result = exact || sameArtist || items[0];
        const image = bestDeezerCover(result?.album);

        setCached(key, image);
        return image;
    } catch (err) {
        console.error("Deezer track image error:", err.response?.data || err.message);
        return null;
    }
}

async function getDeezerAlbumImage(album, artist) {
    const key = cacheKey("album", album, artist);
    const cached = getCached(key);
    if (cached) return cached;

    try {
        const response = await axios.get("https://api.deezer.com/search/album", {
            params: {
                q: `${album} ${artist}`,
                limit: 10,
            },
        });

        const items = response.data?.data || [];
        const albumClean = cleanText(album);

        const exact = items.find((item) => {
            return cleanText(item.title) === albumClean;
        });

        const result = exact || items[0];

        const image =
            result?.cover_xl ||
            result?.cover_big ||
            result?.cover_medium ||
            result?.cover ||
            null;

        setCached(key, image);
        return image;
    } catch (err) {
        console.error("Deezer album image error:", err.response?.data || err.message);
        return null;
    }
}

async function getDeezerArtistImage(artist) {
    const key = cacheKey("artist", artist);
    const cached = getCached(key);
    if (cached) return cached;

    try {
        const response = await axios.get("https://api.deezer.com/search/artist", {
            params: {
                q: artist,
                limit: 10,
            },
        });

        const items = response.data?.data || [];
        const artistClean = cleanText(artist);

        const exact = items.find((item) => {
            return cleanText(item.name) === artistClean;
        });

        const result = exact || items[0];

        const image =
            result?.picture_xl ||
            result?.picture_big ||
            result?.picture_medium ||
            result?.picture ||
            null;

        setCached(key, image);
        return image;
    } catch (err) {
        console.error("Deezer artist image error:", err.response?.data || err.message);
        return null;
    }
}

module.exports = {
    getDeezerTrackImage,
    getDeezerAlbumImage,
    getDeezerArtistImage,
};