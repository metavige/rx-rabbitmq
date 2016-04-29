/**
 * Created by RickyChiang on 2016/4/29.
 */
var mocha = require('mocha');
var chai = require('chai');
var expect = chai.expect;
var rxrabbit = require('../src/RxRabbit');

var RABBIT_URI = 'amqp://192.168.99.102:35672';

describe("測試 RxRabbit", function () {

  function getSocket () {
    return { uri: RABBIT_URI, SocketName: "test" };
  }

  it.skip('ECONNFUSED 測試', function (done) {
    var sub = new rxrabbit.Sub({ uri: null, SocketName: "test" });
    var disposable = sub.connect();

    sub.stream.subscribeOnError(function (err) {
      console.log(err);
      expect(err).has.property("code");
      expect(err.code).to.eql("ECONNREFUSED");
      disposable.dispose();
      done();
    });

  });

  it("PUB 傳送訊息", function (done) {

    console.log("==========================================");
    // var optsPub = { uri: RABBIT_URI, SocketName: "test" };
    var pub = new rxrabbit.Pub(getSocket());

    var disposable = pub.connect();

    var writeDisposable = pub.connectStream.subscribeOnNext(function (val) {
      console.log('conenctStream onNext');
      pub.write({ test: false })
        .concat(pub.write({ test: true }))
        .subscribeOnCompleted(function () {
          writeDisposable.dispose();
          disposable.dispose();
          done();
        })
    });
  });

  it("PUB 傳送訊息，但是不等到 connectStream completed", function (done) {

    console.log("==========================================");
    // var optsPub = { uri: RABBIT_URI, SocketName: "test" };
    var pub = new rxrabbit.Pub(getSocket());

    var disposable = pub.connect();

    pub.write({ test: false })
      .concat(pub.write({ test: true }))
      .subscribeOnCompleted(function () {
        disposable.dispose();
        done();
      })
  });

  it("PUB/SUB 訂閱與傳送訊息", function (done) {

    console.log("==========================================");
    // var optsPub = { uri: RABBIT_URI, SocketName: "test" };
    // var optsSub = { uri: RABBIT_URI, SocketName: "test" };
    var pub = new rxrabbit.Pub(getSocket());
    var sub = new rxrabbit.Sub(getSocket());

    var disposablePub = pub.connect();
    var disposableSub = sub.connect();

    var disposable1 = sub.stream.skip(1).subscribe(function (val) {
        expect(val).eql({ test: "ping" });
        disposable1.dispose();
        done();
      })
      ;

    var disposable2 = sub.stream.take(1).subscribe(function (val) {
        pub.write({ test: "ping" });
        disposable2.dispose();
      })
      ;
  });

  it('PUSH 傳送訊息', function (done) {
    var push = new rxrabbit.Push(getSocket());

    var disposable = push.connect();

    push.write({ test: false })
      .concat(push.write({ data: 2 }))
      .subscribeOnCompleted(function () {
        disposable.dispose();
        done();
      })
  });
});