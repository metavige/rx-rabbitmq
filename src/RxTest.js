var Rx = require('rx');

var subject = new Rx.Subject();

subject.subscribe(
  function onNext(val) {
    console.log('onnext:', val);
  },
  function onError(err) {
    console.log('error:', err);
  },
  function onCompleted() {
    console.log('onCompleted');
  }
);

setInterval(function () {
  subject.onNext(new Date());
}, 500);