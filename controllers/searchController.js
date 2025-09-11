const YouTubeService = require('../services/youtubeService');
const CsvService = require('../services/csvService');
const { CHANNELS } = require('../config/channels');
const { delay } = require('../utils/helpers');

class SearchController {
  constructor(apiKey, cache) {
    this.youtubeService = new YouTubeService(apiKey);
    this.cache = cache;
  }

  async searchInChannel(req, res) {
    try {
      const { channelId, q, startDate, endDate, maxResults = 50 } = req.query;

      const cacheKey = `${channelId || ''}_${q || ''}_${startDate || ''}_${endDate || ''}_${maxResults}`;
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      const results = await this.youtubeService.searchVideosInChannel(
        channelId, q, startDate, endDate, maxResults
      );

      if (results.length > 0) {
        CsvService.generateChannelCsv(results, channelId);
      }

      this.cache.set(cacheKey, results);
      res.json(results);
    } catch (error) {
      console.error('Erro na busca:', error.message);
      res.status(500).json({ 
        error: 'Failed to fetch search results', 
        details: error.message 
      });
    }
  }

  async searchInAllChannels(req, res) {
    try {
      const { q, startDate, endDate, maxResults = 10 } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Missing search query (q parameter)' });
      }

      const cacheKey = `all_channels_${q}_${startDate || ''}_${endDate || ''}_${maxResults}`;
      const cachedData = this.cache.get(cacheKey);
      if (cachedData) {
        return res.json(cachedData);
      }

      const allResults = [];
      const channelIds = Object.keys(CHANNELS);
      
      console.log(`Iniciando busca em ${channelIds.length} canais para: "${q}"`);

      const batchSize = 5;
      for (let i = 0; i < channelIds.length; i += batchSize) {
        const batch = channelIds.slice(i, i + batchSize);
        
        const promises = batch.map(async (channelId) => {
          try {
            console.log(`Buscando no canal: ${CHANNELS[channelId]} (${channelId})`);
            const results = await this.youtubeService.searchVideosInChannel(
              channelId, q, startDate, endDate, maxResults
            );
            return results;
          } catch (error) {
            console.error(`Erro no canal ${CHANNELS[channelId]}:`, error.message);
            return [];
          }
        });

        const batchResults = await Promise.all(promises);
        batchResults.forEach(results => allResults.push(...results));
        
        if (i + batchSize < channelIds.length) {
          await delay(1000);
        }
      }

      allResults.sort((a, b) => new Date(a['Data da Publicação']) - new Date(b['Data da Publicação']));

      console.log(`Busca concluída. ${allResults.length} vídeos encontrados.`);

      CsvService.generateConsolidatedCsv(allResults, q);

      const response = {
        total: allResults.length,
        channels_searched: channelIds.length,
        query: q,
        results: allResults
      };

      this.cache.set(cacheKey, response);
      res.json(response);

    } catch (error) {
      console.error('Erro na busca em todos os canais:', error.message);
      res.status(500).json({ 
        error: 'Failed to search all channels', 
        details: error.message 
      });
    }
  }

  async searchByChannelName(req, res) {
    try {
      const { name, q, startDate, endDate } = req.query;

      if (!name) {
        return res.status(400).json({ error: 'Missing channel name' });
      }

      const channelId = await this.youtubeService.searchChannelByName(name);
      const results = await this.youtubeService.searchVideosInChannel(
        channelId, q, startDate, endDate
      );

      res.json(results);
    } catch (error) {
      console.error('Erro na busca por nome:', error.message);
      if (error.message === 'Channel not found') {
        return res.status(404).json({ error: 'Channel not found' });
      }
      res.status(500).json({ 
        error: 'Failed to fetch channel by name', 
        details: error.message 
      });
    }
  }
}

module.exports = SearchController;