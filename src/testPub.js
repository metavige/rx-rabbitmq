/**
 * Created by RickyChiang on 2016/4/29.
 */

var RxRabbit = require('./RxRabbit');

process.on('unhandledRejection', function(reason, p){
  console.log("---Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
  // application specific logging here
});

process.on('uncaughtException', function (err) {
  console.log('---uncaughtException', err);
})
;
var url = 'amqp://localhost';

var pub = new RxRabbit.TopicPub({ uri: url, SocketName: 'test.topic', isReconnect: true });

// var count = 10;
var ticket;
function SendData () {

  var data = { date: new Date() };
  console.log('prepare connecting....');
  var disposable2 = pub.connect();
  pub.connectStream
    .subscribe(function (socket) {
        console.log('send: ', data);
        socket.end(JSON.stringify(data), 'utf8');
        disposable2.dispose();
      }, function (err) {
        console.log('錯誤發生：', err);
      },
      function () {
        pub.close();
      });

  ticket = setTimeout(SendData, 1000);
}

SendData();


