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
                        process.env.SPOTIFY_CLIENT_ID + ":" + process.env.SPOTIFY_CLIENT_SECRET
                    ).toString("base64"),
                "Content-Type": "application/x-www-form-urlencoded",
            },
        }
    );

    return response.data.access_token;
}

function getBestImage(images) {
    return images?.[0]?.url || null;
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

async function getTrackImage(song, artist) {
    const data = await spotifySearch("track", `track:"${song}" artist:"${artist}"`, 5);
    const items = data.tracks?.items || [];

    const exact = items.find((track) =>
        track.name.toLowerCase() === song.toLowerCase() &&
        track.artists.some((a) => a.name.toLowerCase() === artist.toLowerCase())
    );

    const track = exact || items[0];

    return getBestImage(track?.album?.images);
}

async function getArtistImage(artist) {
    const data = await spotifySearch("artist", `artist:"${artist}"`, 10);
    const items = data.artists?.items || [];

    const exact = items.find(
        (item) => item.name.toLowerCase() === artist.toLowerCase()
    );

    const result = exact || items[0];

    return getBestImage(result?.images);
}

async function getAlbumImage(album, artist) {
    const data = await spotifySearch("album", `album:"${album}" artist:"${artist}"`, 5);
    const items = data.albums?.items || [];

    const exact = items.find((item) =>
        item.name.toLowerCase() === album.toLowerCase() &&
        item.artists.some((a) => a.name.toLowerCase() === artist.toLowerCase())
    );

    const result = exact || items[0];

    return getBestImage(result?.images);
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