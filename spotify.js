const axios = require("axios");
const querystring = require("querystring");

async function getSpotifyAccessToken() {
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

    return response.data.access_token;
}

function getBestImage(images) {
    return images?.find((img) => img?.url)?.url || null;
}

async function spotifySearch(type, query, limit = 5) {
    const token = await getSpotifyAccessToken();

    const response = await axios.get("https://api.spotify.com/v1/search", {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        params: {
            q: query,
            type,
            limit,
        },
    });

    return response.data;
}

function cleanText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/feat\.|ft\./g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function getTrackImage(song, artist) {
    const queries = [
        `track:"${song}" artist:"${artist}"`,
        `${song} ${artist}`,
        song,
    ];

    for (const query of queries) {
        const data = await spotifySearch("track", query, 10);
        const items = data.tracks?.items || [];

        const exact = items.find((track) => {
            const trackName = cleanText(track.name);
            const songName = cleanText(song);
            const artists = track.artists || [];

            return (
                trackName === songName &&
                artists.some((a) => cleanText(a.name) === cleanText(artist))
            );
        });

        const withImage =
            exact ||
            items.find((track) => track.album?.images?.length) ||
            items[0];

        const image = getBestImage(withImage?.album?.images);
        if (image) return image;
    }

    return null;
}

async function getArtistImage(artist) {
    const queries = [`artist:"${artist}"`, artist];

    for (const query of queries) {
        const data = await spotifySearch("artist", query, 10);
        const items = data.artists?.items || [];

        const exact = items.find(
            (item) => cleanText(item.name) === cleanText(artist)
        );

        const withImage =
            exact?.images?.length
                ? exact
                : items.find((item) => item.images?.length) || items[0];

        const image = getBestImage(withImage?.images);
        if (image) return image;
    }

    return null;
}

async function getAlbumImage(album, artist) {
    const queries = [
        `album:"${album}" artist:"${artist}"`,
        `${album} ${artist}`,
        album,
    ];

    for (const query of queries) {
        const data = await spotifySearch("album", query, 10);
        const items = data.albums?.items || [];

        const exact = items.find((item) => {
            const albumName = cleanText(item.name);
            const targetAlbum = cleanText(album);
            const artists = item.artists || [];

            return (
                albumName === targetAlbum &&
                artists.some((a) => cleanText(a.name) === cleanText(artist))
            );
        });

        const withImage =
            exact ||
            items.find((item) => item.images?.length) ||
            items[0];

        const image = getBestImage(withImage?.images);
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