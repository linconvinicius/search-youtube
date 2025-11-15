const { google } = require('googleapis');

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
   * Inicializa autenticação com Google Sheets API
   * @param {Object|string} credentials - Credenciais JSON ou caminho do arquivo
   */
  initializeAuth(credentials) {
    try {
      let auth;
      
      // Se for string, assume que é caminho do arquivo
      if (typeof credentials === 'string') {
        const fs = require('fs');
        const path = require('path');
        
        // Verificar se o arquivo existe
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
        // Se for objeto, usa diretamente
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
   * Obtém todos os IDs de vídeos já cadastrados na planilha
   * @param {string} range - Range da planilha (ex: 'Sheet1!A:A')
   * @returns {Promise<Set<string>>} Set com IDs de vídeos existentes
   */
  async getExistingVideoIds(range = 'Sheet1!A6:A') {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets não inicializado. Configure as credenciais.');
      }

      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: range,
      });

      const rows = response.data.values || [];
      const existingIds = new Set();

      // Pular cabeçalho (linha 5) e pegar IDs da coluna A (índice 0)
      // Assumindo que a linha 5 é o cabeçalho e os dados começam na linha 6
      rows.forEach((row, index) => {
        // Pular linha 0 (cabeçalho na planilha) e pegar IDs
        if (index > 0 && row[0] && row[0].trim()) {
          existingIds.add(row[0].trim());
        }
      });

      return existingIds;
    } catch (error) {
      console.error('Erro ao buscar vídeos existentes:', error.message);
      // Retorna set vazio em caso de erro para não bloquear a inserção
      return new Set();
    }
  }

  /**
   * Converte dados do YouTube para formato da planilha
   * @param {Object} videoData - Dados do vídeo do YouTube
   * @returns {Array} Array com valores na ordem das colunas da planilha
   */
  formatVideoDataForSheet(videoData) {
    // Formatar data de publicação (de ISO para DD/MM/YYYY)
    let formattedDate = videoData['Data da Publicação'];
    if (formattedDate) {
      try {
        const date = new Date(formattedDate);
        formattedDate = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      } catch (e) {
        // Se falhar, mantém o formato original
      }
    }

    // Mapear dados para as colunas da planilha:
    // ID Video | URL | Titulo | Canal | Data da Publicação | Views | Likes | Duração | Comentarios | Cadastrado
    return [
      videoData['ID Video'] || '',
      videoData['URL do Vídeo'] || '',
      videoData['Titulo'] || '',
      videoData['Canal'] || '',
      formattedDate || '',
      videoData['Visualizações'] || 0,
      videoData['Likes'] || 0,
      videoData['Duração'] || '',
      videoData['Comentarios'] || 0,
      'Cadastrado' // Status fixo
    ];
  }

  /**
   * Adiciona vídeos à planilha (apenas novos, evita duplicatas)
   * @param {Array} videos - Array de objetos com dados dos vídeos
   * @param {string} range - Range onde adicionar (ex: 'Sheet1!A6')
   * @returns {Promise<Object>} Resultado da operação
   */
  async addVideosToSheet(videos, range = 'Sheet1!A6') {
    try {
      if (!this.sheets) {
        throw new Error('Google Sheets não inicializado. Configure as credenciais.');
      }

      if (!videos || videos.length === 0) {
        return { added: 0, skipped: 0, total: 0 };
      }

      // Obter vídeos já existentes
      const existingIds = await this.getExistingVideoIds('Sheet1!A6:A');
      
      // Filtrar apenas vídeos novos
      const newVideos = videos.filter(video => {
        const videoId = video['ID Video'];
        return videoId && !existingIds.has(videoId);
      });

      if (newVideos.length === 0) {
        console.log('📊 Nenhum vídeo novo para adicionar à planilha');
        return { added: 0, skipped: videos.length, total: videos.length };
      }

      // Converter vídeos para formato da planilha
      const values = newVideos.map(video => this.formatVideoDataForSheet(video));

      // Adicionar à planilha
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: range,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: values,
        },
      });

      console.log(`📊 ${newVideos.length} vídeo(s) adicionado(s) à planilha Google Sheets`);
      console.log(`   ${videos.length - newVideos.length} vídeo(s) já existente(s) foram ignorados`);

      return {
        added: newVideos.length,
        skipped: videos.length - newVideos.length,
        total: videos.length,
        updatedCells: response.data.updates?.updatedCells || 0
      };
    } catch (error) {
      console.error('❌ Erro ao adicionar vídeos à planilha:', error.message);
      throw error;
    }
  }

  /**
   * Testa a conexão com a planilha
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

      console.log(`✅ Conectado à planilha: ${response.data.properties.title}`);
      return true;
    } catch (error) {
      console.error('❌ Erro ao conectar com planilha:', error.message);
      return false;
    }
  }
}

module.exports = GoogleSheetsService;

