const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');
const https = require('https');
const fs = require('fs');
const { parse } = require('json2csv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const cache = new NodeCache({ stdTTL: 600 }); // Cache com tempo de vida de 10 minutos

const agent = new https.Agent({
  rejectUnauthorized: false,
});

// Lista de canais automotivos
const CHANNELS = {
  'UCIvQJmPaDR2lMDDNhb4--bA': 'Quatro-Rodas',
  'UCWYuQ9_2boHBxm59n6lSzDA': 'Autoesporte', 
  'UC6Rk7BKVPWkFJ9FiBrts5Vg': 'motor1brasil',
  'UCGhErKQ6LBiCsXE8fWtokfg': 'automaisoficial',
  'UCz2Bb7YdduN4x7qN9oFrJjQ': 'webmotors',
  'UCGBIIPnw0AYM3BFsmTsjeAw': 'Acelerados',
  'UCM7Ysb5r_tVbxGabjTSQgkA': 'decaronacomleandro',
  'UCqtPuAH8q5CgZyp8hklSpNA': 'Macchina',
  'UCoenHRLtKKtutvOQGZzqpCQ': 'duasrodasbr',
  'UC--87koyZy53LgIEBCA1qgg': 'motociclismoonline',
  'UCfReg1ecXWG9Gscjba-dGgw': 'FullpowerTV',
  'UC88Hb8Q8ffGONG7h_W1WXZA': 'UltimaMarcha',
  'UCi7NjYyIQk6hPRbZ4BVKHyw': 'FlatOutBrasil',
  'UCdvtAyfO0ZVfA-UV-lssMQw': 'CanalMotoPlay',
  'UCeLSGU99FGfp77C9WqT15lw': 'Vansfaria',
  'UCJ8A6N9UFaf04Uxf6rLXmPA': 'OntheRoadBr',
  'UCrzsIJIQN_OZPqCa4S7N0rw': 'Pilotoleandromello',
  'UCt_oS5q8BA5iiXv_mmqSByQ': 'PARodaTV',
  'UCMk1wBIsHmalYeE16GkD6bg': 'CarroChefe',
  'UCRQxRSO8SSm6aQV19fjy7UQ': 'CassioCortes',
  'UCIE4i9-elbrBWAtKyJrNdLA': 'durvalcareca',
  'UCNScJ8tFmWbP1QjcKwScK5w': 'MinutoMotor',
  'UCdQiJIRylGydCsHQtCUsTJg': 'EstadaoMobilidade',
  'UChUvS75BR7ziAr7WhrecVsA': 'AutoPapo',
  'UCCykAaNbtxUpGwvkSYWWSKg': 'garagemdobelloteTV',
  'UCPmRf82yxqPJkmfnFzm9Wlw': 'KS1951',
  'UCfyWVInB4nPkZGgiVwGtAiw': 'FalandoDeCarro',
  'UC-qF9N7a3k8v0F9XkSqasKw': 'Autorranking',
  'UCCbD39MVnMsTLGxsHLnOKlg': 'OutopInfinit0_',
  'UCx8Ako_xnMCOd3gDaCl5t7g': 'RevistaMotoAdventureOficial'
};

const parseDuration = (isoDuration) => {
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = match[1] ? match[1].replace('H', '') : '00';
  const minutes = match[2] ? match[2].replace('M', '') : '00';
  const seconds = match[3] ? match[3].replace('S', '') : '00';

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
};

const searchVideosInChannel = async (channelId, q, startDate, endDate, maxResults = 50) => {
  const params = {
    part: 'snippet,id',
    maxResults,
    key: YOUTUBE_API_KEY,
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
      key: YOUTUBE_API_KEY,
    },
    httpsAgent: agent,
  });

  const results = searchResponse.data.items.map((item, index) => {
    const stats = statsResponse.data.items[index]?.statistics || {};
    const rawDuration = statsResponse.data.items[index]?.contentDetails?.duration || 'PT0S';
    const formattedDuration = parseDuration(rawDuration);
    const fullDescription = statsResponse.data.items[index]?.snippet?.description || '';

    // Pegar trecho que menciona BMW (ou palavra-chave especificada)
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
};

// Endpoint original - busca em um canal específico
app.get('/search', async (req, res) => {
  try {
    const { channelId, q, startDate, endDate, maxResults = 50 } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'Missing YouTube API key' });
    }

    const cacheKey = `${channelId || ''}_${q || ''}_${startDate || ''}_${endDate || ''}_${maxResults}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const results = await searchVideosInChannel(channelId, q, startDate, endDate, maxResults);

    // Gerar CSV
    if (results.length > 0) {
      const resultsForCsv = results.map(({ Descrição, ...rest }) => rest);
      const fileName = `videos_${channelId}_${new Date().toISOString().split('T')[0]}.csv`;
      
      const fileExists = fs.existsSync(fileName);
      const csv = parse(resultsForCsv, { header: !fileExists });

      if (fileExists) {
        fs.appendFileSync(fileName, '\n' + csv);
      } else {
        fs.writeFileSync(fileName, csv);
      }
    }

    cache.set(cacheKey, results);
    res.json(results);
  } catch (error) {
    console.error('Erro na busca:', error.message);
    res.status(500).json({ error: 'Failed to fetch search results', details: error.message });
  }
});

// Novo endpoint - busca em todos os canais
app.get('/search-all-channels', async (req, res) => {
  try {
    const { q, startDate, endDate, maxResults = 10 } = req.query;

    if (!YOUTUBE_API_KEY) {
      return res.status(500).json({ error: 'Missing YouTube API key' });
    }

    if (!q) {
      return res.status(400).json({ error: 'Missing search query (q parameter)' });
    }

    const cacheKey = `all_channels_${q}_${startDate || ''}_${endDate || ''}_${maxResults}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    const allResults = [];
    const channelIds = Object.keys(CHANNELS);
    
    console.log(`Iniciando busca em ${channelIds.length} canais para: "${q}"`);

    // Processar canais em lotes para evitar rate limiting
    const batchSize = 5;
    for (let i = 0; i < channelIds.length; i += batchSize) {
      const batch = channelIds.slice(i, i + batchSize);
      
      const promises = batch.map(async (channelId) => {
        try {
          console.log(`Buscando no canal: ${CHANNELS[channelId]} (${channelId})`);
          const results = await searchVideosInChannel(channelId, q, startDate, endDate, maxResults);
          return results;
        } catch (error) {
          console.error(`Erro no canal ${CHANNELS[channelId]}:`, error.message);
          return [];
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(results => allResults.push(...results));
      
      // Delay entre lotes para evitar rate limiting
      if (i + batchSize < channelIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Ordenar por data de publicação (mais antigas primeiro)
    allResults.sort((a, b) => new Date(a['Data da Publicação']) - new Date(b['Data da Publicação']));

    console.log(`Busca concluída. ${allResults.length} vídeos encontrados.`);

    // Gerar CSV consolidado
    if (allResults.length > 0) {
      const resultsForCsv = allResults.map(({ Descrição, ...rest }) => rest);
      const fileName = `videos_all_channels_${q}_${new Date().toISOString().split('T')[0]}.csv`;
      const csv = parse(resultsForCsv);
      fs.writeFileSync(fileName, csv);
    }

    cache.set(cacheKey, allResults);
    res.json({
      total: allResults.length,
      channels_searched: channelIds.length,
      query: q,
      results: allResults
    });

  } catch (error) {
    console.error('Erro na busca em todos os canais:', error.message);
    res.status(500).json({ error: 'Failed to search all channels', details: error.message });
  }
});

// Endpoint para listar canais disponíveis
app.get('/channels', (req, res) => {
  const channelList = Object.entries(CHANNELS).map(([id, name]) => ({
    id,
    name,
    url: `https://youtube.com/channel/${id}`
  }));
  
  res.json({
    total: channelList.length,
    channels: channelList
  });
});

// Endpoint original - busca por nome do canal
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
    const results = await searchVideosInChannel(channelId, q, startDate, endDate);

    res.json(results);
  } catch (error) {
    console.error('Erro na busca por nome:', error.message);
    res.status(500).json({ error: 'Failed to fetch channel by name', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📺 ${Object.keys(CHANNELS).length} canais automotivos cadastrados`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`   GET /search - Busca em um canal específico`);
  console.log(`   GET /search-all-channels - Busca em todos os canais`);
  console.log(`   GET /channels - Lista todos os canais`);
  console.log(`   GET /searchByName - Busca por nome do canal`);
});