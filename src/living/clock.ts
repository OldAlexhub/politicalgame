import { DAY_MS } from '../../packages/simulation';
/** Clock never includes time spent backgrounded, paused, or suspended by the OS. */
export class SimulationClock {
  private previous = 0;
  private accumulated = 0;
  reset(now: number) {
    this.previous = now;
    this.accumulated = 0;
  }
  sample(now: number, speed: 0 | 1 | 2 | 4): number {
    const elapsed = Math.max(0, now - this.previous);
    this.previous = now;
    if (!speed || elapsed > 1500) {
      this.accumulated = 0;
      return 0;
    }
    this.accumulated += elapsed * speed;
    const days = Math.floor(this.accumulated / DAY_MS);
    this.accumulated -= days * DAY_MS;
    return days;
  }
}
