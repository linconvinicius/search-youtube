const cron = require('node-cron');
const SearchController = require('../controllers/searchController');

class SchedulerService {
  constructor(apiKey, cache, googleSheetsService = null) {
    this.searchController = new SearchController(apiKey, cache, googleSheetsService);
    this.tasks = [];
  }

  /**
   * Configura busca automática diária
   * @param {string} searchQuery - Termo de busca
   * @param {string} cronSchedule - Cron schedule (padrão: '0 2 * * *' = 2h da manhã todos os dias)
   * @param {number} maxResults - Número máximo de resultados por canal
   * @param {string} startDate - Data inicial (opcional, se não informado busca vídeos do último dia)
   * @param {string} endDate - Data final (opcional)
   */
  scheduleDailySearch(searchQuery, cronSchedule = '0 2 * * *', maxResults = 10, startDate = null, endDate = null) {
    if (!searchQuery) {
      throw new Error('Search query is required');
    }

    console.log(`📅 Agendando busca automática diária:`);
    console.log(`   Termo de busca: "${searchQuery}"`);
    console.log(`   Horário: ${this.getCronDescription(cronSchedule)}`);
    console.log(`   Max resultados por canal: ${maxResults}`);

    const task = cron.schedule(cronSchedule, async () => {
      try {
        const dateRange = this.getDateRange(startDate, endDate);
        console.log(`\n⏰ [${new Date().toISOString()}] Executando busca agendada...`);
        console.log(`   Período: ${dateRange.start || 'início'} até ${dateRange.end || 'agora'}`);

        const result = await this.searchController.executeSearchInAllChannels(
          searchQuery,
          dateRange.start,
          dateRange.end,
          maxResults,
          false // Não usa cache para buscas agendadas (sempre busca dados atualizados)
        );

        console.log(`✅ Busca agendada concluída com sucesso!`);
        console.log(`   Total de vídeos encontrados: ${result.total}`);
        console.log(`   Canais pesquisados: ${result.channels_searched}`);
        console.log(`   Arquivo CSV gerado: videos_${searchQuery}_${new Date().toISOString().split('T')[0]}.csv\n`);

      } catch (error) {
        console.error(`❌ Erro na busca agendada:`, error.message);
        console.error(error.stack);
      }
    }, {
      scheduled: true,
      timezone: "America/Sao_Paulo" // Fuso horário do Brasil
    });

    this.tasks.push({
      query: searchQuery,
      schedule: cronSchedule,
      task: task
    });

    return task;
  }

  /**
   * Calcula o range de datas para a busca
   * Se startDate não for informado, busca vídeos das últimas 24 horas
   */
  getDateRange(startDate, endDate) {
    if (startDate && endDate) {
      return { start: startDate, end: endDate };
    }

    if (startDate) {
      return { start: startDate, end: null };
    }

    // Se não houver startDate, busca vídeos das últimas 24 horas
    const end = endDate ? new Date(endDate) : new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 1); // Últimas 24 horas

    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  /**
   * Retorna descrição legível do cron schedule
   */
  getCronDescription(schedule) {
    const descriptions = {
      '0 0 * * *': 'Meia-noite todos os dias',
      '0 2 * * *': '2h da manhã todos os dias',
      '0 6 * * *': '6h da manhã todos os dias',
      '0 12 * * *': 'Meio-dia todos os dias',
      '0 18 * * *': '18h todos os dias',
      '0 */6 * * *': 'A cada 6 horas',
      '0 */12 * * *': 'A cada 12 horas'
    };

    return descriptions[schedule] || schedule;
  }

  /**
   * Para todas as tarefas agendadas
   */
  stopAll() {
    this.tasks.forEach(({ query, task }) => {
      task.stop();
      console.log(`⏹️  Busca agendada parada: "${query}"`);
    });
    this.tasks = [];
  }

  /**
   * Lista todas as tarefas agendadas
   */
  listTasks() {
    return this.tasks.map(({ query, schedule }) => ({
      query,
      schedule,
      description: this.getCronDescription(schedule)
    }));
  }
}

module.exports = SchedulerService;

