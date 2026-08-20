import { extractIntent } from '../src/gemini.js';

async function run() {
  const history = [
    { role: 'user', text: 'What is my attendance?' },
    { role: 'assistant', text: 'Hi Aarav! Your current attendance is 94%.' }
  ];
  console.log('Testing extractIntent with history...');
  const res = await extractIntent('What about last week specifically?', history);
  console.log('RESULT:', JSON.stringify(res, null, 2));
}

run().catch(console.error);
