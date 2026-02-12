import { styleText } from 'node:util';

const CLEAR = '\r\x1b[K';
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface Spinner {
  setMessage: (message: string) => void;
  appendMessage: (extra: string) => void;
  stop: () => void;
};

export function startSpinner(message: string): Spinner {
  let i = 0;
  const interval = setInterval(() => {
    process.stdout.write(`\r${styleText("gray", `${FRAMES[i++ % FRAMES.length]} ${message}`)}`);
  }, 80);

  return {
    stop() {
      clearInterval(interval);
      process.stdout.write(CLEAR);
    },
    setMessage(newMessage: string) {
      message = newMessage;
    },
    appendMessage(extra: string) {
      message += extra;
    }
  };
}
