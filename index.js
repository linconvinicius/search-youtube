const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');
const createApiRoutes = require('./routes/api');
const { CHANNELS } = require('./config/channels');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const cache = new NodeCache({ stdTTL: 600 });

app.use('/', createApiRoutes(YOUTUBE_API_KEY, cache));

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /search - Busca em um canal específico',
      'GET /search-all-channels - Busca em todos os canais',
      'GET /channels - Lista todos os canais',
      'GET /searchByName - Busca por nome do canal'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('Erro não tratado:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: error.message 
  });
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