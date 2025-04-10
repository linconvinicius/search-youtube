const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');
const https = require('https'); // Adicionado para ignorar certificado SSL
const fs = require('fs'); // Adicionado para gerar CSV
const { parse } = require('json2csv');

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const cache = new NodeCache({ stdTTL: 600 }); // Cache com tempo de vida de 10 minutos

const agent = new https.Agent({
  rejectUnauthorized: false, // Ignora certificados SSL inválidos
});

const parseDuration = (isoDuration) => {
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = match[1] ? match[1].replace('H', '') : '00';
  const minutes = match[2] ? match[2].replace('M', '') : '00';
  const seconds = match[3] ? match[3].replace('S', '') : '00';

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
};

app.get('/search', async (req, res) => {
  try {
    const { channelId, q, startDate, endDate } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'Missing YouTube API key' });
    }

    const cacheKey = `${channelId || ''}_${q || ''}_${startDate || ''}_${endDate || ''}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const params = {
      part: 'snippet,id',
      maxResults: 5, // Reduzindo para minimizar consumo
      key: YOUTUBE_API_KEY,
      order: 'date',
    };

    if (channelId) params.channelId = channelId;
    if (q) params.q = q;
    if (startDate) params.publishedAfter = new Date(startDate).toISOString();
    if (endDate) params.publishedBefore = new Date(endDate).toISOString();

    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params,
      httpsAgent: agent, // Usa o agente que ignora o certificado SSL
    });

    const videoIds = searchResponse.data.items.map(item => item.id.videoId).join(',');

    const statsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'statistics,contentDetails,snippet',
        id: videoIds,
        key: YOUTUBE_API_KEY,
      },
      httpsAgent: agent,
    });

    const results = searchResponse.data.items.map((item, index) => {
      const stats = statsResponse.data.items[index]?.statistics || {};
      const rawDuration = statsResponse.data.items[index]?.contentDetails?.duration || 'PT0S';
      const formattedDuration = parseDuration(rawDuration);
      const fullDescription = statsResponse.data.items[index]?.snippet?.description || '';

      // Pegar trecho que menciona BMW
      const bmwMatch = fullDescription.match(/.*?BMW.*?[.!?\n]/gi);
      const bmwDescription = bmwMatch ? bmwMatch.join(' ').trim() : '';

      return {
        "ID Video": item.id.videoId,
        "URL do Vídeo": `https://www.youtube.com/watch?v=${item.id.videoId}`,
        "Titulo": item.snippet.title,
        "Canal": item.snippet.channelTitle,
        "Data da Publicação": item.snippet.publishedAt,
        "Visualizações": stats.viewCount || 0,
        "Likes": stats.likeCount || 0,
        "Duração": formattedDuration,
        "Comentarios": stats.commentCount || 0,
        "Descrição": bmwDescription,
      };
    });

    // Gerar CSV sem o campo "Descrição"
    const resultsForCsv = results.map(({ Descrição, ...rest }) => rest);

    const fileExists = fs.existsSync('videos.csv');
    const csv = parse(resultsForCsv, { header: !fileExists });

    if (fileExists) {
      fs.appendFileSync('videos.csv', '\n' + csv);
    } else {
      fs.writeFileSync('videos.csv', csv);
    }

    cache.set(cacheKey, results); // Armazena no cache
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch search results', details: error.message });
  }
});

app.get('/searchByName', async (req, res) => {
  try {
    const { name, q, startDate, endDate } = req.query;

    if (!name) {
      return res.status(400).json({ error: 'Missing channel name' });
    }

    const searchChannel = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: name,
        type: 'channel',
        maxResults: 1,
        key: YOUTUBE_API_KEY,
      },
      httpsAgent: agent,
    });

    const channel = searchChannel.data.items[0];
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channelId = channel.id.channelId;

    // Redireciona internamente para /search com os parâmetros
    req.query.channelId = channelId;
    delete req.query.name;
    app._router.handle(req, res, () => {}, '/search');
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channel by name', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
