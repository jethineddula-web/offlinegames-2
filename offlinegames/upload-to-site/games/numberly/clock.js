(function (N) {
'use strict';

class GameClock {
  constructor(now = () => performance.now()) {
    this.accumulated = 0;
    this.startedAt = null;
    this.now = now;
  }

  resume() {
    if (this.startedAt === null) this.startedAt = this.now();
  }

  pause() {
    if (this.startedAt !== null) {
      this.accumulated += Math.max(0, this.now() - this.startedAt);
      this.startedAt = null;
    }
  }

  seconds() {
    return (this.accumulated + (this.startedAt === null ? 0 : Math.max(0, this.now() - this.startedAt))) / 1000;
  }
}

function verifyClock() {
  let now = 0;
  const clock = new GameClock(() => now);
  clock.resume();
  now = 1200;
  if (clock.seconds() !== 1.2) throw new Error('Clock elapsed-time check failed');
  clock.pause();
  now = 9000;
  if (clock.seconds() !== 1.2) throw new Error('Clock pause check failed');
  clock.resume();
  clock.resume();
  now = 9300;
  clock.pause();
  clock.pause();
  if (clock.seconds() !== 1.5) throw new Error('Clock resume check failed');
}

verifyClock();
Object.assign(N, { GameClock, verifyClock });
})(globalThis.Numberly = globalThis.Numberly || {});