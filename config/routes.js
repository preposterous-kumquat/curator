const redis = require('redis');
const geolib = require('geolib');
const bluebird = require('bluebird');
const client = redis.createClient();
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client.on('error', (err) => {
  console.log('redis error!', err);
});

module.exports = (app, express) => {
  app.get('/getstack', (req, res) => {
    console.log(req.query)
    let seedId = req.query.id;
    let seedTheme = req.query.theme;
    client.hgetallAsync(`gps:${seedId}`).then( (data) => {
      let oppLoc = {
        lat: data.latitude > 0 ? -(data.latitude) : Math.abs(data.latitude),
        long: data.longitude > 0 ? -(180 - data.longitude) : 180 - Math.abs(data.longitude)
      }
      console.log(oppLoc)

    });
    
  });
  app.post('/save', (req, res) => {
    let data = req.body;
    console.log('posting...', data)
    client.sadd(`set:${data.theme}`, data.id);
    
    client.hmset(`gps:${data.id}`, 'latitude', data.gps.lat, 'longitude', data.gps.long, 'url', data.url);
    // TODO: CREATE SORTED SET BY TIME FOR PICTURES
    res.send();
  });
};