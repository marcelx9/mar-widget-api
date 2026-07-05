const axios = require("axios");
const querystring = require("querystring");

let cachedToken = null;
let tokenExpiresAt = 0;

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
        .replace(/feat\.|ft\./g, "")
        .replace(/with .+/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function spotifySearch(type, query, limit = 10) {
    const token = await getSpotifyAccessToken();

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
}

async function getTrackImage(song, artist) {
    const songClean = cleanText(song);
    const artistClean = cleanText(artist);

    const queries = [
        `${song} ${artist}`,
        `track:${song} artist:${artist}`,
        song,
    ];

    for (const query of queries) {
        const data = await spotifySearch("track", query, 10);
        const items = data.tracks?.items || [];

        const exact = items.find((track) => {
            const trackName = cleanText(track.name);
            const artists = track.artists || [];

            return (
                trackName === songClean &&
                artists.some((a) => cleanText(a.name) === artistClean)
            );
        });

        const partial = items.find((track) => {
            const trackName = cleanText(track.name);
            const artists = track.artists || [];

            return (
                (trackName.includes(songClean) || songClean.includes(trackName)) &&
                artists.some((a) => cleanText(a.name) === artistClean)
            );
        });

        const anyWithSameArtist = items.find((track) =>
            track.artists?.some((a) => cleanText(a.name) === artistClean)
        );

        const result =
            exact ||
            partial ||
            anyWithSameArtist ||
            items.find((track) => track.album?.images?.length) ||
            items[0];

        const image = getBestImage(result?.album?.images);
        if (image) return image;
    }

    return null;
}

async function getArtistImage(artist) {
    const artistClean = cleanText(artist);

    const queries = [
        artist,
        `artist:${artist}`,
        `"${artist}"`,
    ];

    for (const query of queries) {
        const data = await spotifySearch("artist", query, 10);
        const items = data.artists?.items || [];

        const exact = items.find(
            (item) => cleanText(item.name) === artistClean
        );

        const partial = items.find((item) => {
            const name = cleanText(item.name);
            return name.includes(artistClean) || artistClean.includes(name);
        });

        const result =
            exact ||
            partial ||
            items.find((item) => item.images?.length) ||
            items[0];

        const image = getBestImage(result?.images);
        if (image) return image;
    }

    return null;
}

async function getAlbumImage(album, artist) {
    const albumClean = cleanText(album);
    const artistClean = cleanText(artist);

    const queries = [
        `${album} ${artist}`,
        `album:${album} artist:${artist}`,
        album,
    ];

    for (const query of queries) {
        const data = await spotifySearch("album", query, 10);
        const items = data.albums?.items || [];

        const exact = items.find((item) => {
            const albumName = cleanText(item.name);
            const artists = item.artists || [];

            return (
                albumName === albumClean &&
                artists.some((a) => cleanText(a.name) === artistClean)
            );
        });

        const partial = items.find((item) => {
            const albumName = cleanText(item.name);
            const artists = item.artists || [];

            return (
                (albumName.includes(albumClean) || albumClean.includes(albumName)) &&
                artists.some((a) => cleanText(a.name) === artistClean)
            );
        });

        const result =
            exact ||
            partial ||
            items.find((item) => item.images?.length) ||
            items[0];

        const image = getBestImage(result?.images);
        if (image) return image;
    }

    return null;
}

async function getLikedSongsCount() {
    const token = await getSpotifyAccessToken();

    const response = await axios.get("https://api.spotify.com/v1/me/tracks", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            limit: 1,
        },
    });

    return response.data.total;
}

module.exports = {
    getTrackImage,
    getArtistImage,
    getAlbumImage,
    getLikedSongsCount,
};