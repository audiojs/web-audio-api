var assert = require('assert'),
  OfflineAudioContext = require('../build/OfflineAudioContext');

describe('OfflineAudioContext', function() {
  it('should return a promise rejected with a DOMException whose name is "InvalidStateError" if rendering started flag is true', function(done) {
    // We trigger startRendering 2 times
    // so the 2nd times, the promise should fail
    var context = new OfflineAudioContext(2, 1, 44100);
    context.startRendering().then(function(success) {}, function(error) {});
    assert.equal(context.renderingStartedFlag, true);
    context.startRendering().then(function(success) {}, function(error) {
      done();
    });
  });
  it('it should process correctly the rendering for simple cas audiobuffer', function(done) {
    // test title to improve ...
    // Create and OfflineAudioContext
    var context = new OfflineAudioContext(2, 1024, 44100);
    // Create a simple AudioBufferSource
    var buffer = context.createBuffer(2, 2048, 44100);
    var dataLeft = buffer.getChannelData(0);
    var dataRight = buffer.getChannelData(1);
    for (i = 0; i < dataLeft.length; i++) {
      dataLeft[i] = (Math.random() - 0.5) * 2;
      dataRight[i] = (Math.random() - 0.5) * 2;
    }
    var bufferSourceNode = context.createBufferSource();
    bufferSourceNode.buffer = buffer;
    // Connect the AudioBufferSource to OfflineAudioContext destination
    bufferSourceNode.connect(context.destination);
    bufferSourceNode.start();
    // startRendering
    context.startRendering().then(
      function(outBuff) {
        var outBuffDataLeft = outBuff.getChannelData(0);
        var outBuffDataRight = outBuff.getChannelData(1);
        assert.equal(outBuff.length, 1024);
        for (var i = 0; i < 1024; i++) {
          assert.equal(outBuffDataLeft[i], dataLeft[i]);
          assert.equal(outBuffDataRight[i], dataRight[i]);
        }
        done();
      },
      function(error) {}
    );
  });

});
