const { google } = require('googleapis');

// Nomes das abas em português, correspondendo às abas da planilha "Monitoramento BMW 2026"
const MONTH_TABS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

class GoogleSheetsService {
  constructor(credentials, spreadsheetId) {
    this.spreadsheetId = spreadsheetId;
    this.auth = null;
    this.sheets = null;

    if (credentials) {
      this.initializeAuth(credentials);
    }
  }

  /**
   * Retorna o nome da aba correspondente ao mês atual (ex: 'Abril')
   */
  getCurrentMonthTab() {
    return MONTH_TABS[new Date().getMonth()];
  }

  /**
   * Inicializa autenticação com Google Sheets API
   * @param {Object|string} credentials - Credenciais JSON ou caminho do arquivo
   */
  initializeAuth(credentials) {
    try {
      let auth;

      if (typeof credentials === 'string') {
        const fs = require('fs');
        const path = require('path');

        const credsPath = path.resolve(credentials);
        if (!fs.existsSync(credsPath)) {
          throw new Error(`Arquivo de credenciais não encontrado: ${credsPath}`);
        }

        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
        auth = new google.auth.GoogleAuth({
          credentials: creds,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      } else {
        auth = new google.auth.GoogleAuth({
          credentials: credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
      }

      this.auth = auth;
      this.sheets = google.sheets({ version: 'v4', auth });
    } catch (error) {
      console.error('Erro ao inicializar autenticação Google Sheets:', error.message);
      throw error;
    }
  }

  /**
   * Obtém todos os IDs de vídeos já cadastrados na aba do mês
   * @param {string} sheetTab - Nome da aba (ex: 'Abril'). Se não informado, usa o mês atual.
   * @returns {Promise<Set<string>>} Set com IDs de vídeos existentes
   */
  async getExistingVideoIds(sheetTab = null) {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets não inicializado. Configure as credenciais.');
      }

      const tab = sheetTab || this.getCurrentMonthTab();
      const range = `${tab}!A6:A`;

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      const rows = response.data.values || [];
      const existingIds = new Set();

      // O range já começa na linha 6 (dados reais), não há cabeçalho para pular
      rows.forEach((row) => {
        if (row[0] && row[0].trim()) {
          existingIds.add(row[0].trim());
        }
      });

      console.log(`📋 Aba "${tab}": ${existingIds.size} vídeo(s) já cadastrado(s)`);
      return existingIds;
    } catch (error) {
      console.error('Erro ao buscar vídeos existentes:', error.message);
      return new Set();
    }
  }

  /**
   * Converte dados do YouTube para formato da planilha
   * Ordem das colunas: ID Video | URL | Titulo | Canal | Data da Publicação | Views | Likes | Duração | Comentarios |
   * @param {Object} videoData - Dados do vídeo do YouTube
   * @returns {Array} Array com valores na ordem das colunas da planilha
   */
  formatVideoDataForSheet(videoData) {
    let formattedDate = videoData['Data da Publicação'];
    if (formattedDate) {
      try {
        const date = new Date(formattedDate);
        formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      } catch (e) {
        // mantém o formato original em caso de erro
      }
    }

    return [
      videoData['ID Video'] || '',
      videoData['URL do Vídeo'] || '',
      videoData['Titulo'] || '',
      videoData['Canal'] || '',
      formattedDate || '',
      videoData['Visualizações'] || 0,
      videoData['Likes'] || 0,
      videoData['Duração'] || '',
      videoData['Comentarios'] || 0
    ];
  }

  /**
   * Adiciona vídeos à aba do mês correspondente (apenas novos, evita duplicatas)
   * @param {Array} videos - Array de objetos com dados dos vídeos
   * @param {string} sheetTab - Nome da aba (ex: 'Abril'). Se não informado, usa o mês atual.
   * @returns {Promise<Object>} Resultado da operação
   */
  async addVideosToSheet(videos, sheetTab = null) {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets não inicializado. Configure as credenciais.');
      }

      if (!videos || videos.length === 0) {
        return { added: 0, skipped: 0, total: 0 };
      }

      const tab = sheetTab || this.getCurrentMonthTab();
      const range = `${tab}!A6`;

      console.log(`📊 Escrevendo na aba: "${tab}"`);

      // Verificar quais vídeos já existem na aba do mês
      const existingIds = await this.getExistingVideoIds(tab);

      // Filtrar apenas vídeos novos
      const newVideos = videos.filter(video => {
        const videoId = video['ID Video'];
        return videoId && !existingIds.has(videoId);
      });

      if (newVideos.length === 0) {
        console.log(`📊 Nenhum vídeo novo para adicionar à aba "${tab}"`);
        return { added: 0, skipped: videos.length, total: videos.length, tab };
      }

      const values = newVideos.map(video => this.formatVideoDataForSheet(video));

      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values },
      });

      console.log(`📊 ${newVideos.length} vídeo(s) adicionado(s) à aba "${tab}"`);
      console.log(`   ${videos.length - newVideos.length} vídeo(s) duplicado(s) ignorado(s)`);

      return {
        added: newVideos.length,
        skipped: videos.length - newVideos.length,
        total: videos.length,
        tab,
        updatedCells: response.data.updates?.updatedCells || 0
      };
    } catch (error) {
      console.error('❌ Erro ao adicionar vídeos à planilha:', error.message);
      throw error;
    }
  }

  /**
   * Testa a conexão com a planilha e lista as abas disponíveis
   * @returns {Promise<boolean>} true se conectado com sucesso
   */
  async testConnection() {
    try {
      if (!this.sheets) {
        return false;
      }

      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const title = response.data.properties.title;
      const tabs = response.data.sheets.map(s => s.properties.title);
      console.log(`✅ Conectado à planilha: "${title}"`);
      console.log(`   Abas disponíveis: ${tabs.join(', ')}`);
      console.log(`   Aba do mês atual: "${this.getCurrentMonthTab()}"`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com planilha:', error.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsService;