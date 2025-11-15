#!/usr/bin/env node

/**
 * Script standalone para executar busca agendada
 * Pode ser executado diretamente ou via cron do sistema operacional
 * 
 * Uso:
 *   node scripts/run-scheduled-search.js
 * 
 * Ou via cron:
 *   0 2 * * * cd /caminho/do/projeto && node scripts/run-scheduled-search.js
 */

const dotenv = require('dotenv');
const path = require('path');

// Carregar variáveis de ambiente
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SearchController = require('../controllers/searchController');
const NodeCache = require('node-cache');

// Configurações
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SEARCH_QUERY = process.env.SCHEDULER_SEARCH_QUERY || process.env.SEARCH_QUERY || '';
const MAX_RESULTS = parseInt(process.env.SCHEDULER_MAX_RESULTS || process.env.MAX_RESULTS || '10');
const START_DATE = process.env.SCHEDULER_START_DATE || process.env.START_DATE || null;
const END_DATE = process.env.SCHEDULER_END_DATE || process.env.END_DATE || null;

// Validar configurações
if (!YOUTUBE_API_KEY) {
  console.error('❌ Erro: YOUTUBE_API_KEY não configurada no .env');
  process.exit(1);
}

if (!SEARCH_QUERY) {
  console.error('❌ Erro: SCHEDULER_SEARCH_QUERY ou SEARCH_QUERY não configurada no .env');
  process.exit(1);
}

// Cache (opcional, não usado para buscas agendadas)
const cache = new NodeCache({ stdTTL: 600 });

// Configuração do Google Sheets (opcional)
let googleSheetsService = null;
const GOOGLE_SHEETS_ENABLED = process.env.GOOGLE_SHEETS_ENABLED === 'true';
const GOOGLE_SHEETS_SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS || process.env.GOOGLE_SHEETS_CREDENTIALS_PATH;

if (GOOGLE_SHEETS_ENABLED && GOOGLE_SHEETS_SPREADSHEET_ID) {
  try {
    const GoogleSheetsService = require('../services/googleSheetsService');
    let credentials = null;

    if (GOOGLE_SHEETS_CREDENTIALS) {
      try {
        credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
      } catch (e) {
        credentials = GOOGLE_SHEETS_CREDENTIALS;
      }
    }

    googleSheetsService = new GoogleSheetsService(credentials, GOOGLE_SHEETS_SPREADSHEET_ID);
    console.log('📊 Google Sheets configurado para busca agendada');
  } catch (error) {
    console.error('⚠️  Erro ao configurar Google Sheets:', error.message);
  }
}

// Executar busca
async function executeSearch() {
  try {
    console.log(`\n⏰ [${new Date().toISOString()}] Iniciando busca agendada...`);
    console.log(`   Termo de busca: "${SEARCH_QUERY}"`);
    console.log(`   Max resultados por canal: ${MAX_RESULTS}`);
    
    if (START_DATE) {
      console.log(`   Data inicial: ${START_DATE}`);
    } else {
      console.log(`   Período: Últimas 24 horas`);
    }
    
    if (END_DATE) {
      console.log(`   Data final: ${END_DATE}`);
    }

    const searchController = new SearchController(YOUTUBE_API_KEY, cache, googleSheetsService);
    
    // Calcular datas se não fornecidas (últimas 24 horas)
    let startDate = START_DATE;
    let endDate = END_DATE;
    
    if (!startDate) {
      const end = endDate ? new Date(endDate) : new Date();
      const start = new Date(end);
      start.setDate(start.getDate() - 1);
      startDate = start.toISOString();
      endDate = end.toISOString();
    }

    const result = await searchController.executeSearchInAllChannels(
      SEARCH_QUERY,
      startDate,
      endDate,
      MAX_RESULTS,
      false // Não usa cache para buscas agendadas
    );

    console.log(`\n✅ Busca agendada concluída com sucesso!`);
    console.log(`   Total de vídeos encontrados: ${result.total}`);
    console.log(`   Canais pesquisados: ${result.channels_searched}`);
    console.log(`   Query: ${result.query}`);
    console.log(`   Executado em: ${result.executedAt}`);
    
    const csvFileName = `videos_${SEARCH_QUERY}_${new Date().toISOString().split('T')[0]}.csv`;
    console.log(`   Arquivo CSV gerado: ${csvFileName}\n`);

    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Erro na busca agendada:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Executar
executeSearch();

