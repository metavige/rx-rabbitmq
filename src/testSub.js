// var rabbitjs = require('rabbit.js');
// var Rx = require('rx');
// var random = require('random-gen');
// var RxNode = require('rx-node');

var RxRabbit = require('./RxRabbit');

console.log(process.env);

process.on('unhandledRejection', function(reason, p){
  console.log("---Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
  // application specific logging here
});

process.on('uncaughtException', function (err) {
  console.log('---uncaughtException', err);
})
;

var url = 'amqp://localhost';

// =======================================

var __sub = null;
var disposableSub = null;
function createSub () {
  __sub = new RxRabbit.TopicSub({ uri: url, SocketName: 'test.topic' });

  disposableSub = __sub.connect();

  __sub.stream
    .filter(function(v) { return v !== null; })
    .subscribe(function (val) {
      console.log('接收資料！', val);
    }, function (err) {
      console.log('SUB MQ ERROR: ', err);
      disposableSub.dispose();
      __sub.close();
      // 重新連線
      setTimeout(createSub, 3000);
    });
}

createSub();

