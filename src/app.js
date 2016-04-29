// var rabbitjs = require('rabbit.js');
var winston = require('winston');
// var util = require('util');
// var EventEmitter = require('events').EventEmitter;
var MessageQueueAdapter = require('./mq');
var random = require('random-gen');
var Rx = require('rx');
// var RxNode = require('rx-node');

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'debug',
      timestamp: function () {
        return '[' + new Date().toLocaleString() + ']';
      },
      formatter: function (options) {
        // Return string will be passed to logger.
        return options.timestamp() + '[' + options.level.toUpperCase() + ']\t - ' + (undefined !== options.message ? options.message : '') +
        (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
      }
    })
  ]
});

var url = 'amqp://192.168.99.102:35672';
// var rabbitContext = null;
var ticket = null;

var mqObj = new MessageQueueAdapter(url, 'Consumer');

// // Rx test
// var source = Rx.Observable.fromEvent(mqObj, 'connected', function (context) {
//   logger.info('取得 context:', context);
//   return context;
// });
// source.subscribe(function (args) {
//   logger.debug('Rx FromEvent:', args);
// });

mqObj.on('connected', function (context) {
  // try {
  var sub = context.socket('SUB', {
    routing: 'topic'
  });
  sub.setEncoding('utf8');

  sub.connect('test.topic', function () {
    sub.on('data', function (msg) {
      logger.debug('接收資料：', msg);
    });
    sub.on('error', function (err) {
      logger.error('SUB Error: ', err);
    });
  });

  logger.info('啟動 SUB Socket.....');

  // 當確認連線上了之後，才開始/繼續傳送資料
  ticket = setTimeout(function () {
    logger.debug('啟動 Producer.....');
    sender(context);
  }, random.number(3));
// } catch (err) {
//   logger.error('傳送資料發生錯誤！！！');
// }
});
mqObj.on('error', function () {
  if (ticket != null) {
    logger.debug('clear ticket');
    clearTimeout(ticket);
    ticket = null;
  }
});
mqObj.init();

// var testDataSource = Rx.Observable.interval(1000);

// =======================================
// Producer
// =======================================

// // 一個測試的方法，用來建立 PUB, 傳送資料
function sender (context) {
  var pub = context.socket('PUB', {
    routing: 'topic'
  });

  var data = { date: new Date().toLocaleString() };

  pub.connect('test.topic', function (val) {
    logger.info('連線 PUB，準備傳送資料', val);
    pub.on('error', function () {
      logger.error('PUB 傳送資料發生錯誤！！！');
    });
    pub.end(JSON.stringify(data), 'utf8');
    // producerContext = null;
    logger.debug('準備執行下一次的傳送資料');

    ticket = setTimeout(function () {
      sender(context);
    }, 1000);
  });
}

// var producerContext = new MessageQueueAdapter(url);
// producerContext.on('connected', function (context) {
//   // 當確認連線上了之後，才開始/繼續傳送資料
//   ticket = setTimeout(function () {
//     sender(context);
//   }, random.number(3));
// });
// producerContext.on('error', function () {
//   // logger.debug('debug error from producerContext', err.message);
//   if (ticket != null) {
//     logger.debug('clear ticket');
//     clearTimeout(ticket);
//     ticket = null;
//   }
// });
// producerContext.init();

function ProgramExit () {
  mqObj.close();
  logger.info('Program Exit.....');
  process.exit(0);
}

// Ctrl+C
process.on('SIGINT', ProgramExit);
process.on('SIGTERM', ProgramExit);
