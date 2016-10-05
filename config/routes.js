const redis = require('redis');
const geolib = require('geolib');
const bluebird = require('bluebird');
const client = redis.createClient({
  host: 'redis'
});
const request = require('request');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client.on('error', (err) => {
  console.log('redis error!', err);
});

module.exports = (app, express) => {
  app.get('/getstack', (req, res) => {
    let seedId = req.query.id;
    let seedTheme = req.query.theme;

//FIND GPS DATA FOR SEED PHOTO AND GET COORDS FOR ANTIPODAL POINT
    client.hgetallAsync(`photo:${seedId}`)
    .then( (data) => {
      let oppLoc = {
        lat: data.lat > 0 ? -(data.lat) : Math.abs(data.lat),
        long: data.long > 0 ? -(180 - data.long) : 180 - Math.abs(data.long)
      };
      
//GET 100 MOST RECENT PHOTOS IN SEED'S THEME      
      client.lrangeAsync(`list:${seedTheme}`, 0, 400)
      .then( (list) => {
//DRAW A LINE BETWEEN SEED AND ANTIPODAL POINT AND TAKE ALL PHOTOS ALONG THAT LINE
        let oneDirectionPoints = {};
        let stack = [];
        oneDirectionPoints[seedId] = {
          latitude: data.lat,
          longitude: data.long,
          url: data.url
        };
        for (let i = 0; i < list.length; i += 4) {
          if (list[i] > Math.min(data.long, oppLoc.long) && list[i] < Math.max(data.long, oppLoc.long)) {
            oneDirectionPoints[list[i+2]] = {};
            oneDirectionPoints[list[i+2]].latitude = list[i+1];
            oneDirectionPoints[list[i+2]].longitude = list[i];
            oneDirectionPoints[list[i+2]].url = list[i+3];
          }
        }
//ORDER BY DISTANCE FROM SEED POINT
        let orderedPoints = geolib.orderByDistance({latitude: data.lat, longitude: data.long}, oneDirectionPoints);
//NAIVE CURATOR (TAKES EVERY NTH PHOTO TO MAKE A STACK OF stackLength)
        let stackLength = 5;
        if (orderedPoints.length > stackLength) {
          let pluckEvery = Math.floor(orderedPoints.length / stackLength);
          for (var i = pluckEvery - 1; i < orderedPoints.length; i += pluckEvery) {
            stack.push(orderedPoints[i]);
          }
        } else {
          stack = orderedPoints;
        }

        //save stack for later retrieval TODO: CHECK IF STACK EXISTS BEFORE MAKING QUERY TO MODEL
        client.set(`stack:${seedId}`, JSON.stringify(stack));

        res.send(stack);
      });

    });

    
  });
  app.post('/save', (req, res) => {
    let data = req.body;
    console.log('posting...', data)
    // client.lpush(`list:${data.theme}`, data.url, data.id, data.gps.lat, data.gps.long);

    // List for creating training corpus
    client.lpush('trainingCorpus', data.id, data.theme, JSON.stringify(data.clarifaiKeywords))

    // all data for each pic
    client.hmset(`photo:${data.id}`, 'lat', data.gps.lat, 'long', data.gps.long, 'url', data.url, 'keywords', JSON.stringify(data.clarifaiKeywords));

    request

    // TODO: CREATE SORTED SET BY TIME FOR PICTURES
    res.send();
  });
};