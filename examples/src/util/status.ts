import { styleText } from 'node:util';

const CLEAR = '\r\x1b[K';
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export class Status {
  private interval: NodeJS.Timer;
  private message: string;
  private i: number;

  constructor(message: string) {
    this.message = message;
    this.i = 0;
    this.interval = setInterval(() => {
      process.stdout.write(styleText("gray", `${CLEAR}${FRAMES[this.i]} ${this.message}`));
      this.i = (this.i + 1) % FRAMES.length;
    }, 80);
  }
  setMessage(message: string) {
    this.message = message;
  }
  appendMessage(extra: string) {
    this.message += extra;
  }
  clear() {
    clearInterval(this.interval);
    process.stdout.write(CLEAR);
  }
}
