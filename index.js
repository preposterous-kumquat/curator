const express = require('express');
const app = express();
const port = process.env.NODE_ENV === 'PROD' ? 80 : 3002;

require('./config/middleware.js')(app, express);
require('./config/routes.js')(app, express);

app.listen(port, function() {
  console.log('Listening on http://localhost:', port);
});
