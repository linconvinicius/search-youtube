# YouTube Automotive API

API para busca de vídeos em canais automotivos do YouTube com funcionalidades de cache e exportação CSV.

## 📁 Estrutura do Projeto

```
projeto/
├── config/
│   └── channels.js          
├── controllers/
│   ├── searchController.js  
│   └── channelsController.js 
├── services/
│   ├── youtubeService.js    
│   └── csvService.js        
├── routes/
│   └── api.js              
├── utils/
│   └── helpers.js          
├── index.js                
├── package.json
├── .env
└── README.md
```

## 🚀 Responsabilidades Separadas

### **config/channels.js**
- Configuração centralizada dos canais automotivos
- Mapping entre ID do canal e nome

### **services/youtubeService.js**
- Integração com YouTube API
- Busca de vídeos e estatísticas
- Busca de canais por nome

### **services/csvService.js**
- Geração de arquivos CSV
- Formatação dos dados para exportação

### **controllers/searchController.js**
- Lógica de negócio das buscas
- Gerenciamento de cache
- Coordenação entre serviços

### **controllers/channelsController.js**
- Listagem de canais disponíveis
- Formatação de dados de canais

### **routes/api.js**
- Definição das rotas
- Middlewares de validação
- Instanciação dos controladores

### **utils/helpers.js**
- Funções utilitárias
- Parsing de duração
- Configuração HTTPS

### **index.js**
- Configuração do servidor Express
- Inicialização da aplicação
- Middlewares globais

## ⚙️ Configuração

1. **Instalar dependências:**
```bash
npm install
```

2. **Configurar variáveis de ambiente:**
Crie um arquivo `.env` na raiz do projeto:
```env
YOUTUBE_API_KEY=sua_chave_da_api_aqui
PORT=3000
```

3. **Executar a aplicação:**
```bash
# Produção
npm start

# Desenvolvimento (com nodemon)
npm run dev
```

## 📋 Endpoints Disponíveis

### `GET /search`
Busca vídeos em um canal específico.

**Parâmetros:**
- `channelId` - ID do canal no YouTube
- `q` - Termo de busca (opcional)
- `startDate` - Data inicial (ISO format)
- `endDate` - Data final (ISO format)
- `maxResults` - Número máximo de resultados (padrão: 50)

### `GET /search-all-channels`
Busca vídeos em todos os canais configurados.

**Parâmetros:**
- `q` - Termo de busca (obrigatório)
- `startDate` - Data inicial (ISO format)
- `endDate` - Data final (ISO format)
- `maxResults` - Número máximo de resultados por canal (padrão: 10)

### `GET /channels`
Lista todos os canais configurados.

### `GET /searchByName`
Busca canal pelo nome e retorna vídeos.

**Parâmetros:**
- `name` - Nome do canal (obrigatório)
- `q` - Termo de busca (opcional)
- `startDate` - Data inicial (ISO format)
- `endDate` - Data final (ISO format)

## 🎯 Estrutura

1. **Separação de Responsabilidades:** Cada arquivo tem uma responsabilidade específica
2. **Manutenibilidade:** Código mais organizado e fácil de manter
3. **Testabilidade:** Funções isoladas são mais fáceis de testar
4. **Reutilização:** Serviços podem ser reutilizados em diferentes contextos
5. **Escalabilidade:** Estrutura permite crescimento organizado do projeto

## 🔧 Adicionando Novos Canais

Para adicionar novos canais, edite o arquivo `config/channels.js`:

```javascript
const CHANNELS = {
  // ... canais existentes
  'NOVO_CHANNEL_ID': 'Nome do Novo Canal'
};
```

## 📊 Geração de CSV

A API gera automaticamente arquivos CSV:
- **Busca individual:** `videos_{channelId}_{data}.csv`
- **Busca em todos os canais:** `videos_{query}_{data}.csv`

## 🛡️ Tratamento de Erros

- Middleware global de tratamento de erros
- Validação de parâmetros obrigatórios
- Rate limiting para evitar sobrecarga da API
- Cache para reduzir chamadas desnecessárias

## 🕒 Cache

- Cache de 10 minutos por padrão
- Chaves de cache baseadas nos parâmetros da busca
- Melhora significativa na performance