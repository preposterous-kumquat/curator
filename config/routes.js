const Redis = require('ioredis');
const redis = new Redis(6379);

module.exports = (app, express) => {
  app.get('/getStack', (req, res) => {

  });
  app.post('/save', (req, res) => {
    let data = req.body;
    //create url associated with photo id
    redis.set(data.id, data.url);
    //add photo id to theme set
    redis.ssad(data.theme, data.id);
  });
};