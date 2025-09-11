const { CHANNELS } = require('../config/channels');

class ChannelsController {
  static getChannels(req, res) {
    const channelList = Object.entries(CHANNELS).map(([id, name]) => ({
      id,
      name,
      url: `https://youtube.com/channel/${id}`
    }));
    
    res.json({
      total: channelList.length,
      channels: channelList
    });
  }
}

module.exports = ChannelsController;