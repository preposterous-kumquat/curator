const redis = require('redis');
const geolib = require('geolib');
const bluebird = require('bluebird');
const client = redis.createClient({
  host: 'redis'
});
const request = require('request');
const fs = require('fs');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

client.on('error', (err) => {
  console.log('redis error!', err);
});

let trainingCounter = 4501;

module.exports = (app, express) => {
  app.get('/getstack', (req, res) => {
    let seedId = req.query.id;
    let seedTheme = req.query.theme;

    client.get(`stack:${seedId}`, (err, savedStack) => {
      if (savedStack) {
        res.send(JSON.parse(savedStack))
      } else {
    //FIND GPS DATA FOR SEED PHOTO AND GET COORDS FOR ANTIPODAL POINT
        client.hgetallAsync(`photo:${seedId}`)
        .then( (data) => {
          let oppLoc = {
            lat: data.lat > 0 ? -(data.lat) : Math.abs(data.lat),
            long: data.long > 0 ? -(180 - data.long) : 180 - Math.abs(data.long)
          };

    //GET 100 MOST SIMILAR PHOTOS IN DB  
          let config = {
            method: 'GET',
            uri: 'http://simserver:5000/query',
            qs: {
              id: seedId
            }
          }    
          request(config, (err, list) => {
            if (err) {
              console.log('error getting list from Model', err);
            } else {
    //DRAW A LINE BETWEEN SEED AND ANTIPODAL POINT AND TAKE ALL PHOTOS ALONG THAT LINE
              let query = [];
              let listArray = JSON.parse(list.body)
              listArray.forEach( (id) => {
                query.push('lat:' + id);
                query.push('long:' + id);
                query.push('url:' + id);
              })
    //QUERY REDIS FOR LATS, LONGS AND URLS OF EACH PHOTO
              client.mget(query, (err, listResults) => {
                let oneDirectionPoints = {};
                let stack = [];
                oneDirectionPoints[seedId] = {
                  latitude: data.lat,
                  longitude: data.long,
                  url: data.url
                };

                for (let i = 0; i < listResults.length; i += 3) {
                  if (listResults[i] && listResults[i+1] > Math.min(data.long, oppLoc.long) && listResults[i+1] < Math.max(data.long, oppLoc.long)) {
                    let id = listArray[Math.ceil(i/3)];
                    console.log(id)
                    oneDirectionPoints[id] = {};
                    oneDirectionPoints[id].latitude = listResults[i];
                    oneDirectionPoints[id].longitude = listResults[i+1];
                    oneDirectionPoints[id].url = listResults[i+2];
                  }
                }
        //ORDER BY DISTANCE FROM SEED POINT
                let orderedPoints = geolib.orderByDistance({latitude: data.lat, longitude: data.long}, oneDirectionPoints);
        //TAKE THE MOST SIMILAR PHOTO FROM EACH REGION
                let stackLength = 5;
                if (orderedPoints.length > stackLength) {
                  let pluckEvery = Math.floor(orderedPoints.length / stackLength);
                  for (let i = 0; i < orderedPoints.length; i += pluckEvery) {
                    let lowestIndex = listArray.length - 1;
                    let mostSimilarInGroup;
                    for (let j = i; j < i + pluckEvery; j++) {
                      let indexCheck = listArray.indexOf(orderedPoints[j].key)
                      if (indexCheck < lowestIndex)
                      lowestIndex = indexCheck;
                      mostSimilarInGroup = orderedPoints[j];
                    }
                    stack.push(mostSimilarInGroup);
                  }
                } else {
                  stack = orderedPoints;
                }
                //save stack for later retrieval 
                client.set(`stack:${seedId}`, JSON.stringify(stack));
                res.send(stack);  
              })
            }
          });
        });  
      }
    })   
  });

  app.post('/save', (req, res) => {
    let data = req.body;
    console.log('posting...', data)
    // client.lpush(`list:${data.theme}`, data.url, data.id, data.gps.lat, data.gps.long);

    // List for creating training corpus
    client.lpush('index', data.id, data.theme, JSON.stringify(data.clarifaiKeywords))

    // all data for each pic
    client.hmset(`photo:${data.id}`, 'lat', data.gps.lat, 'long', data.gps.long, 'url', data.url, 'keywords', JSON.stringify(data.clarifaiKeywords));

    client.mset(`lat:${data.id}`, data.gps.lat, `long:${data.id}`, data.gps.long, `url:${data.id}`, data.url);

    client.lrangeAsync('index', 0, -1)
      .then( (list) => {
        let json = [];
        for (var i = 0; i < list.length; i += 3) {
          json.push({
            id: list[i+2],
            tokens: JSON.parse(list[i])
          });
        }
        let config = {
          method: 'POST',
          uri: 'http://simserver:5000/index',
          json: json
        };
        request(config, (err, response, body) => {
          if (err) {
            console.log('error indexing document to model', err)
          }
          // console.log(response, 'repsonse from PYTHON<<<<<<<<<<<<<<<<<<<<<<<<<<')
          res.send();
        })
    });

    // TODO: CREATE SORTED SET BY TIME FOR PICTURES
  });

  app.post('/train', (req, res) => {

    client.lrangeAsync('index', 0, -1)
      .then( (list) => {
        let json = [];
        for (var i = 0; i < list.length; i += 3) {
          json.push({
            id: list[i+2],
            tokens: JSON.parse(list[i])
          });
        }
        let config = {
          method: 'POST',
          uri: 'http://simserver:5000/train',
          json: trainingCorpus
        }
        request(config, (err, response, body) => {
          if (err) {
            console.log('error training model', err)
          }
          // console.log(response, 'repsonse from PYTHON<<<<<<<<<<<<<<<<<<<<<<<<<<')
          res.send();
        })
    });
  });

  app.post('/getTrainingData', (req, res) => {
    console.log(trainingCounter)
    let batchSize = 20;
    let config = {
      method: 'POST',
      uri: 'photo-processor:3001/getTrainingData',
      json: {"firstNum":trainingCounter,"batchSize":batchSize}
    };
    request(config, (err, response, body) => {
      console.log('response:', body);
      trainingCounter += batchSize;
      let appendMe = JSON.stringify(body).slice(1,-1) + ',\n';
      fs.appendFile('trainingCorpus.json', appendMe, (err) => {
        if (err) throw err;
        console.log('The "data to append" was appended to file!');
        res.send();
      });
    });
  })
};