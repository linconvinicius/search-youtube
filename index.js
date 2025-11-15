const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const NodeCache = require('node-cache');
const createApiRoutes = require('./routes/api');
const SchedulerService = require('./services/schedulerService');
const { CHANNELS } = require('./config/channels');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

const cache = new NodeCache({ stdTTL: 600 });

// Configuração do Google Sheets (opcional)
let googleSheetsService = null;
const GOOGLE_SHEETS_ENABLED = process.env.GOOGLE_SHEETS_ENABLED === 'true';
const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;

if (GOOGLE_SHEETS_ENABLED && GOOGLE_SHEETS_SPREADSHEET_ID) {
  try {
    const GoogleSheetsService = require('./services/googleSheetsService');
    let credentials = null;

    if (GOOGLE_SHEETS_CREDENTIALS) {
      // Se for caminho de arquivo, será carregado pelo serviço
      // Se for JSON string, precisa ser parseado
      try {
        credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
      } catch (e) {
        // Se não for JSON válido, assume que é caminho de arquivo
        credentials = GOOGLE_SHEETS_CREDENTIALS;
      }
    }

    if (!credentials) {
      console.warn('⚠️  Google Sheets habilitado mas credenciais não fornecidas');
      console.warn('   Configure GOOGLE_SHEETS_CREDENTIALS ou GOOGLE_SHEETS_CREDENTIALS_PATH no .env');
    } else {
      googleSheetsService = new GoogleSheetsService(credentials, GOOGLE_SHEETS_SPREADSHEET_ID);
      
      // Testar conexão (não bloqueia a inicialização)
      googleSheetsService.testConnection().then(connected => {
        if (connected) {
          console.log('✅ Google Sheets configurado e conectado');
        }
      }).catch(err => {
        console.warn('⚠️  Não foi possível conectar ao Google Sheets:', err.message);
        console.warn('   A busca continuará funcionando, mas sem integração com planilha');
      });
    }
  } catch (error) {
    console.error('⚠️  Erro ao configurar Google Sheets:', error.message);
    console.error('   A busca continuará funcionando, mas sem integração com planilha');
    // Não bloqueia a inicialização do servidor
    googleSheetsService = null;
  }
}

app.use('/', createApiRoutes(YOUTUBE_API_KEY, cache, googleSheetsService));

// Configuração do agendamento automático
const ENABLE_SCHEDULER = process.env.ENABLE_SCHEDULER === 'true';
const SCHEDULER_SEARCH_QUERY = process.env.SCHEDULER_SEARCH_QUERY || '';
const SCHEDULER_CRON_SCHEDULE = process.env.SCHEDULER_CRON_SCHEDULE || '0 2 * * *'; // 2h da manhã por padrão
const SCHEDULER_MAX_RESULTS = parseInt(process.env.SCHEDULER_MAX_RESULTS || '10');
const SCHEDULER_START_DATE = process.env.SCHEDULER_START_DATE || null;
const SCHEDULER_END_DATE = process.env.SCHEDULER_END_DATE || null;

if (ENABLE_SCHEDULER && SCHEDULER_SEARCH_QUERY) {
  const scheduler = new SchedulerService(YOUTUBE_API_KEY, cache, googleSheetsService);
  
  scheduler.scheduleDailySearch(
    SCHEDULER_SEARCH_QUERY,
    SCHEDULER_CRON_SCHEDULE,
    SCHEDULER_MAX_RESULTS,
    SCHEDULER_START_DATE,
    SCHEDULER_END_DATE
  );
  
  console.log(`\n🤖 Agendamento automático ATIVADO`);
  console.log(`   Busca será executada diariamente às 2h da manhã (horário de Brasília)`);
  if (googleSheetsService) {
    console.log(`   📊 Integração com Google Sheets: ATIVADA`);
  }
} else if (ENABLE_SCHEDULER && !SCHEDULER_SEARCH_QUERY) {
  console.warn(`\n⚠️  Agendamento automático habilitado mas SCHEDULER_SEARCH_QUERY não configurado`);
  console.warn(`   Configure a variável SCHEDULER_SEARCH_QUERY no arquivo .env`);
}

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
  console.log(`\n💡 Para ativar busca automática diária, configure no .env:`);
  console.log(`   ENABLE_SCHEDULER=true`);
  console.log(`   SCHEDULER_SEARCH_QUERY=seu_termo_de_busca`);
});