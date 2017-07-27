var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('express-busboy');
var https = require('https');
var fs = require('fs');

var monk = require('monk');
var session = require('express-session');
var MongoStore = require('connect-mongodb-session')(session);
var api = require('./routes/api');
var config = require('./config.js');

var app = express();
var options = {
  key: fs.readFileSync('./public/certs/key.pem'),
  cert: fs.readFileSync('./public/certs/cert.pem')
};
var server = https.createServer(options, app);
let serverPort = 3001;

var db = monk(config.mongo.host+':'+config.mongo.port+'/'+config.mongo.db);
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'nunjucks');

bodyParser.extend(app, {
  upload: true,
  mimeTypeLimit: ['image/jpeg','image/png','image/gif'],
  json: true,
  urlencoded: true
});

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(function(req, res, next) {
 res.setHeader('Access-Control-Allow-Origin', ['https://23.239.1.81:3000']);
// res.setHeader('Access-Control-Allow-Origin', 'http://23.239.1.81:5000');
 res.setHeader('Access-Control-Allow-Credentials', 'true');
 res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
 res.setHeader('Access-Control-Allow-Headers', 'Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers, Set-Cookie, Cookie');
 res.setHeader('Cache-Control', 'no-cache');
 next();
});
app.use(cookieParser());
app.use(session({
    secret: config.session.secret,
    store: new MongoStore({
        uri: 'mongodb://'+config.session.store.host+':'+config.session.store.port+'/'+config.session.store.db ,
        collection: config.session.store.collection
    }),
    saveUninitialized: false,
    resave: false
}));

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  req.db = db;
  next();
});


app.use('/', api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  console.log(err.stack);
  res.status(err.status || 500).send();
});

server.listen(serverPort, (err) => {
  if (err) {
    console.log(err.stack);
  } else {
    console.log('secure server up');
  }
}); 

module.exports = app;
