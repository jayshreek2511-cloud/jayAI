import { createApp } from './app.js';
import { logKeyMode } from './gemini.js';

const port = process.env.PORT || 3001;
const app = createApp({ jwtSecret: process.env.JWT_SECRET });

app.listen(port, () => {
  console.log(`XYZ AI backend listening on http://localhost:${port}`);
  logKeyMode();
});
