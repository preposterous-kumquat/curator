const redis = require('redis');
const client = redis.createClient();

client.on('error', (err) => {
  console.log('redis error!', err);
});

module.exports = (app, express) => {
  app.get('/getstack', (req, res) => {
    let seed = req.body.id;
    console.log(seed);
  });
  app.post('/save', (req, res) => {
    let data = req.body;
    console.log('posting...', data)
    client.sadd(`set:${data.theme}`, data.id);
    
    client.hmset(`gps:${data.id}`, 'latitude', data.gps.lat, 'longitude', data.gps.long);
    // TODO: CREATE SORTED SET BY TIME FOR PICTURES
    res.send();
  });
};