const fs = require('fs');
const { parse } = require('json2csv');

class CsvService {
  static generateCsv(results, fileName) {
    if (results.length === 0) {
      return;
    }

    const resultsForCsv = results.map(({ Descrição, ...rest }) => rest);
    
    const fileExists = fs.existsSync(fileName);
    const csv = parse(resultsForCsv, { header: !fileExists });

    if (fileExists) {
      fs.appendFileSync(fileName, '\n' + csv);
    } else {
      fs.writeFileSync(fileName, csv);
    }
  }

  static generateConsolidatedCsv(results, query) {
    if (results.length === 0) {
      return;
    }

    const resultsForCsv = results.map(({ Descrição, ...rest }) => rest);
    const fileName = `videos_${query}_${new Date().toISOString().split('T')[0]}.csv`;
    const csv = parse(resultsForCsv);
    fs.writeFileSync(fileName, csv);
  }

  static generateChannelCsv(results, channelId) {
    const fileName = `videos_${channelId}_${new Date().toISOString().split('T')[0]}.csv`;
    this.generateCsv(results, fileName);
  }
}

module.exports = CsvService;