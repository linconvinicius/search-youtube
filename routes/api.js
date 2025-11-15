const express = require('express');
const SearchController = require('../controllers/searchController');
const ChannelsController = require('../controllers/channelsController');

const createApiRoutes = (apiKey, cache, googleSheetsService = null) => {
  const router = express.Router();
  const searchController = new SearchController(apiKey, cache, googleSheetsService);

  const validateApiKey = (req, res, next) => {
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing YouTube API key' });
    }
    next();
  };

  router.use(['/search', '/search-all-channels', '/searchByName'], validateApiKey);

  router.get('/search', (req, res) => searchController.searchInChannel(req, res));
  router.get('/search-all-channels', (req, res) => searchController.searchInAllChannels(req, res));
  router.get('/searchByName', (req, res) => searchController.searchByChannelName(req, res));

  router.get('/channels', ChannelsController.getChannels);

  return router;
};

module.exports = createApiRoutes;