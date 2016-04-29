var rabbitjs = require('rabbit.js');
var Rx = require('rx');
var random = require('random-gen');
// var RxNode = require('rx-node');

var RxRabbit = require('./RxRabbit');

var url = 'amqp://192.168.99.102:35672';

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
//
// var pub = new RxRabbit.TopicPub({ uri: url, SocketName: 'test.topic' });
// var disposable2 = pub.connect();
//
// function reconnectPub (err) {
//   console.log('PUB 發生錯誤', err);
//   setTimeout(function () {
//     // pub.connectStream.onCompleted();
//     pub = new RxRabbit.TopicPub({ uri: url, SocketName: 'test.topic' });
//     disposable2 = pub.connect();
//     pub.connectStream.subscribeOnError(reconnectPub);
//   }, 1000);
// };
//
// pub.connectStream.subscribeOnError(reconnectPub);

var pub = new RxRabbit.TopicPub({ uri: url, SocketName: 'test.topic', isReconnect:true });
var count = 10;
var ticket;
function SendData () {
  var data = { date: new Date() } ;
  var disposable2 = pub.connect();
  pub.connectStream
    .subscribe(function (socket) {
      socket.end(JSON.stringify(data), 'utf8');
      disposable2.dispose();
    }, function(err) {
      console.log(err);
    });
  // pub.write(data)
  //   .subscribe(function () {},
  //     function (err) {
  //       console.log('pub error', err);
  //       disposable2.dispose();
  //       // pub.close();
  //     },
  //     function () {
  //       disposable2.dispose();
  //       // pub.close();
  //     });

  ticket = setTimeout(SendData, 1000);

}

// SendData();

