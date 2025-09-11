const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const parseDuration = (isoDuration) => {
  const match = isoDuration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
  const hours = match[1] ? match[1].replace('H', '') : '00';
  const minutes = match[2] ? match[2].replace('M', '') : '00';
  const seconds = match[3] ? match[3].replace('S', '') : '00';

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  agent,
  parseDuration,
  delay
};