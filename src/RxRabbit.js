/**
 * RxJS - RabbitMQ 版本
 *
 * 參考 da-rabbitmq-rx 這個套件的內容
 * 另外加上連線中斷時會自動重連的功能
 *
 * Created: 2016/04/28
 * Maintainer: Ricky Chiang
 */

var rabbit = require('rabbit.js');
var winston = require('winston');
var Rx = require('rx');
var RxNode = require('rx-node');

var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[ p ] = b[ p ];
    function __ () { this.constructor = d; }

    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
  };

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

var rxRabbit;
(function (RxRabbit) {
  /**
   * 一般 Socket 的 Base Class
   */
  var RxRabbitBase = rxRabbit.RxRabbitBase = (function () {

    function RxRabbitBase (opts) {
      this.opts = opts;
    }

    /**
     * 建立與 RABBITMQ 的連線 Socket
     * @param queue
     * @param socket
     * @returns {IObservable}
     */
    RxRabbitBase.connectSocket = function (queue, socket) {
      logger.debug('socket connect ...... ');

      var socketErrorStream = Rx.Observable.fromEvent(socket, 'error')
        .flatMap(function (val) {
          logger.error('socket error event:', val);
          return Rx.Observable.throw(val);
        });

      // 用 fromCallback, 如果有發生錯誤，會當做 Stream 的資料傳入
      var socketConnectStream = Rx.Observable.fromCallback(socket.connect)(queue)
        .map(function (val) {
          if (val && val.status === 'error') {
            logger.error('create socket error:', val);
            // throw val;
            return Rx.Observable.throw(val);
          } else {
            // 呼叫 connect 方法之後
            logger.debug('[', queue, ']', ', Socket 已連線');
            // return socket;
            return Rx.Observable.return(socket);
          }
        })
        .flatMap(function (v) { return v; });

      return socketConnectStream.merge(socketErrorStream);
    };

    /**
     * 建立 Context Stream
     *
     * 這邊的 Source 是 error/ready 的 Callback function
     * 當有觸發這兩個事件，便會產生 subscribe 事件
     */
    RxRabbitBase.createContextStream = function (__instance) {

      // 關閉之前的連線，如果有存在的話
      __instance.close();

      var uri = __instance.opts.uri;

      logger.debug('rabbitjs context creating.....');
      var context = rabbit.createContext(uri);
      __instance.context = context;

      // 錯誤事件 stream
      var contextErrorStream = Rx.Observable.fromEvent(context, 'error')
        .flatMap(function (val) {
          var code = val.code;
          if (code == undefined) {
            // logger.debug(val);
            code = 'ERROR_UNDEFINED';
          }
          logger.error('MQ 連線發生錯誤:', '[' + code + ']', val.message);
          return Rx.Observable.throw(val);
        });
      // 如果是 Ready 事件，只需要回傳 ready 事件的參數就好
      var contextReadyStream = Rx.Observable.fromEvent(context, 'ready')
        .map(function () {
          logger.debug('rabbitjs context ready.....');
          return context;
        });

      // 合併 ready / error 事件，變成同一個 Stream
      return contextErrorStream
      // .merge(contextCloseStream)
        .merge(contextReadyStream);
    };

    /**
     * 建立 Rabbitjs Context 的 Stream
     *
     * @returns {IObservable}
     */
    RxRabbitBase.prototype.connectContext = function () {
      var self = this;
      var contextStream = RxRabbitBase.createContextStream(this);
      
      // 以下是建立 Socket Stream
      return contextStream.map(
        function (context) {
          logger.debug('建立 Socket.....', JSON.stringify(self.opts));
          if (self.opts.socketOpts === undefined || self.opts.socketOpts === null) {
            return context.socket(self.opts.SocketType);
          } else {
            return context.socket(self.opts.SocketType, self.opts.socketOpts);
          }
        })
        .flatMap(function (socket) {
          // logger.debug('呼叫建立 Socket 方法 - ', self.opts.SocketName, self.opts.SocketType);
          return RxRabbitBase.connectSocket(self.opts.SocketName, socket);
        });
    };

    /**
     * 關閉 RabbitMQ 連線
     * 不然有可能會佔著連線
     */
    RxRabbitBase.prototype.close = function () {
      if (this.context != null) {
        try {
          this.context.close();
        }
        catch (err) {
          logger.error('close context error:', err);
        }
        this.context = null;
      }
    };

    return RxRabbitBase;
  })();

  /**
   * Subscriber
   */
  var RxRabbitSub = rxRabbit.Sub = (function (__super) {
    __extends(RxRabbitSub, __super);
    function RxRabbitSub (opts) {
      opts.SocketType = 'SUB';
      __super.call(this, opts);
    }

    /**
     *
     * @returns {IDisposable}
     */
    RxRabbitSub.prototype.connect = function () {
      var self = this;
      // 透過呼叫 connectContext, 就會建立與 RabbitMQ 的連線
      // 當建立連線成功，就會觸發 ready 事件
      // 按照 Stream 的順序，就會進入到這邊的 map 方法
      var stream = __super.prototype.connectContext.call(this)
        .map(function (socket) {
          logger.info('設定 socket - ', self.opts.SocketName);
          socket.setEncoding('utf8');
          // 這邊另外建立一個新的 Observable, 用來接聽 socket data 事件
          // 所以需要搭配下面的 flatMap 方法，轉換 streaming data 為 data 事件的參數資料
          return Rx.Observable.return(null).concat(RxNode.fromReadableStream(socket));
        })
        .flatMap(function (val) { return val; })
        .map(function (val) { return val ? JSON.parse(val) : null; });

      this.stream = stream.publish();
      return this.stream.connect();
    };

    return RxRabbitSub;
  })(RxRabbitBase);

  /**
   * Rabbit SUB Socket
   */
  var RxRabbitTopicSub = rxRabbit.TopicSub = (function (__super) {
    __extends(RxRabbitTopicSub, __super);

    function RxRabbitTopicSub (opts) {
      opts.socketOpts = { routing: 'topic' };
      __super.call(this, opts);
    }

    RxRabbitTopicSub.prototype.connect = function () {
      return RxRabbitSub.prototype.connect.call(this);
    };

    return RxRabbitTopicSub;
  })(RxRabbitSub);

  /**
   * Publisher
   */
  var RxRabbitPub = rxRabbit.Pub = (function (__super) {
    __extends(RxRabbitPub, __super);
    function RxRabbitPub (opts) {
      if (opts.SocketType == undefined) opts.SocketType = 'PUB';
      __super.call(this, opts);
    }

    /**
     * 與 Pub 連線     *
     * @return IDisposable
     */
    RxRabbitPub.prototype.connect = function () {
      // 呼叫 connectContext 方法
      logger.debug('connect socket');
      // 用 REPLAY 取得最後一次的 item
      var stream = __super.prototype.connectContext.call(this).replay(null, 1);
      var disposable = stream.connect();
      this.connectStream = stream;
      return disposable;
    };

    /**
     * 將資料透過 socket write 方法寫入資料
     * @param data
     * @returns {Observable}
     */
    RxRabbitPub.prototype.write = function (data) {
      var self = this;

      var observable = Rx.Observable.create(function (observer) {
        return self.connectStream.subscribe(function (socket) {

          logger.debug('create socket error stream');
          var socketErrorStream = Rx.Observable.fromEvent(socket, 'error')
            .map(function (val) {
              logger.error('Socket 發生錯誤:', val.code);
              return Rx.Observable.throw(val);
            });
          socketErrorStream.subscribe(observer);

          var _stringifyData = JSON.stringify(data);
          logger.debug('寫入資料 ..... ', _stringifyData, (socket == null));
          var result = socket.write(_stringifyData, 'utf8');
          observer.onNext(result);
          observer.onCompleted();
        });
      });
      observable
        .catch(function (err) {
          logger.error('傳送資料發生錯誤:', err.message);
          return Rx.Observable.just(true);
        })
        .subscribe(function () {});
      return observable;
    };

    return RxRabbitPub;
  })(RxRabbitBase);

  /**
   * TOPIC Publisher
   */
  var RxRabbitTopicPub = rxRabbit.TopicPub = (function (__super) {
    __extends(RxRabbitTopicPub, __super);

    function RxRabbitTopicPub (opts) {
      opts.socketOpts = { routing: 'topic' };
      __super.call(this, opts);
    }

    RxRabbitTopicPub.prototype.connect = function () {
      return RxRabbitPub.prototype.connect.call(this);
    };

    RxRabbitTopicPub.prototype.write = function (data) {
      return RxRabbitPub.prototype.write.call(this, data);
    };

    return RxRabbitTopicPub;
  })(RxRabbitPub);

  /**
   * Rabbit PUSH Socket
   */
  var RxRabbitPush = rxRabbit.Push = (function (__super) {
    __extends(RxRabbitPush, __super);

    function RxRabbitPush (opts) {
      opts.SocketType = 'PUSH';
      // opts.socketOpts = { routing: 'topic' };
      __super.call(this, opts);
    }

    return RxRabbitPush;
  })(RxRabbitTopicPub);

})(rxRabbit || (rxRabbit = {}));

module.exports = rxRabbit;
