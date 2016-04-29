/**
 * Created by RickyChiang on 2016/4/29.
 */

var RxRabbit = require('./RxRabbit');
var events = require('events')
var Divider = function(){
  events.EventEmitter.call(this)
};
require('util').inherits(Divider, events.EventEmitter);
var divider = new Divider();
divider.on('error', function (err) {
  console.log('global error: ', err);
});

var url = 'amqp://192.168.99.102:35672';

var pub = new RxRabbit.TopicPub({ uri: url, SocketName: 'test.topic', isReconnect: true });

var count = 10;
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


