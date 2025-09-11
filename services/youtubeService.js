const axios = require('axios');
const { agent, parseDuration } = require('../utils/helpers');

class YouTubeService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async searchVideosInChannel(channelId, q, startDate, endDate, maxResults = 50) {
    const params = {
      part: 'snippet,id',
      maxResults,
      key: this.apiKey,
      order: 'date',
      type: 'video'
    };

    if (channelId) params.channelId = channelId;
    if (q) params.q = q;
    if (startDate) params.publishedAfter = new Date(startDate).toISOString();
    if (endDate) params.publishedBefore = new Date(endDate).toISOString();

    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params,
      httpsAgent: agent,
    });

    if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
      return [];
    }

    const videoIds = searchResponse.data.items
      .filter(item => item.id && item.id.videoId)
      .map(item => item.id.videoId)
      .join(',');

    if (!videoIds) return [];

    const statsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'statistics,contentDetails,snippet',
        id: videoIds,
        key: this.apiKey,
      },
      httpsAgent: agent,
    });

    const results = searchResponse.data.items.map((item, index) => {
      const stats = statsResponse.data.items[index]?.statistics || {};
      const rawDuration = statsResponse.data.items[index]?.contentDetails?.duration || 'PT0S';
      const formattedDuration = parseDuration(rawDuration);
      const fullDescription = statsResponse.data.items[index]?.snippet?.description || '';

      const keywordMatch = fullDescription.match(new RegExp(`.*?${q}.*?[.!?\\n]`, 'gi'));
      const keywordDescription = keywordMatch ? keywordMatch.join(' ').trim() : '';

      return {
        "ID Video": item.id.videoId,
        "URL do Vídeo": `https://www.youtube.com/watch?v=${item.id.videoId}`,
        "Titulo": item.snippet.title,
        "Canal": item.snippet.channelTitle,
        "Data da Publicação": item.snippet.publishedAt,
        "Visualizações": parseInt(stats.viewCount) || 0,
        "Likes": parseInt(stats.likeCount) || 0,
        "Duração": formattedDuration,
        "Comentarios": parseInt(stats.commentCount) || 0,
        "Descrição": keywordDescription
      };
    });

    return results;
  }

  async searchChannelByName(name) {
    const searchChannel = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: name,
        type: 'channel',
        maxResults: 1,
        key: this.apiKey,
      },
      httpsAgent: agent,
    });

    const channel = searchChannel.data.items[0];
    if (!channel) {
      throw new Error('Channel not found');
    }

    return channel.id.channelId;
  }
}

module.exports = YouTubeService;