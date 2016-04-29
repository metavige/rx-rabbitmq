var rabbitjs = require('rabbit.js');
var winston = require('winston');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var adapterCount = 0;
/**
 * 與 RabbitMQ 之間連線的 Adapter
 */
var MessageQueueAdapter = function (amqp_url, name) {
  var rabbitContext = null;
  var options = {
    url: amqp_url
  };
  if (name !== undefined) {
    options.name = name;
  } else {
    options.name = 'adapter' + ++adapterCount;
  }

  var self = this;
  self.options = options;

  // 內部使用的 Logger
  var logger = new winston.Logger({
    transports: [
      new winston.transports.Console({
        level: 'debug',
        timestamp: function () {
          return '[' + new Date().toLocaleString() + ']';
        },
        formatter: function (options) {
          // Return string will be passed to logger.
          return options.timestamp() + '[' + options.level.toUpperCase() + ']\t - [' + self.options.name + ']' + (undefined !== options.message ? options.message : '') +
          (options.meta && Object.keys(options.meta).length ? '\n\t' + JSON.stringify(options.meta) : '');
        }
      })
    ]
  });

  // =======================================

  /**
   * 關閉 RabbitMQ 連線方法
   */
  function close () {
    if (rabbitContext !== null) {
      rabbitContext.close();
      rabbitContext = null;
      logger.info('關閉 ', options.url);
    }
  }

  /**
   * 啟動 RabbitMQ 連線
   */
  function start () {
    close();

    try {
      var context = rabbitjs.createContext(options.url + '?connection_timeout=10');
      // context.on('all', function () { logger.debug(arguments); })
      // 定義錯誤處理事件
      context.on('error', function (err) {
        logger.error('[AMQP][' + err.code + '] 發生錯誤: ', err.message);

        if (err.code === 'ECONNRESET') {
          // 連線被 Server 終止，需要重新連線
          // 會從 close 事件重新啟動連線
        }
        if (err.code === 'ECONNREFUSED') {
          // 建立連線有問題，需要重新連線
          setTimeout(start, 1000);
        }
        if (err.code === 'ETIMEDOUT') {
          // 連線 TIMEOUT
          logger.error('TIMEOUT, 等一段時間在重新嘗試..... ');
          setTimeout(start, 5000);
        }
        if (err.code === 'EHOSTDOWN') {
          logger.error('Server 關閉，已經連不上了..... ');
          setTimeout(start, 30000);
        }

        // 如果外部有設定 error 事件，觸發事件
        if (self.listenerCount('error') > 0) {
          self.emit('error', err);
        }
      });
      // 定義連線關閉事件
      context.on('close', function () {
        logger.error('[AMQP] closed');
        rabbitContext = null;
        return setTimeout(start, 3000);
      });
      // 定義連接事件
      context.on('ready', function () {
        logger.info('[AMQP] Context ready.....');

        rabbitContext = context;
        // 當連線成功之後，會呼叫這個方法，在這邊可以做之後的設定
        self.emit('connected', context);
      });
    } catch (err) {
      logger.error('start error: ', err);
    }
  // logger.info('context created');
  }

  this.init = start;
  this.close = close;
};

util.inherits(MessageQueueAdapter, EventEmitter);

module.exports = MessageQueueAdapter;
