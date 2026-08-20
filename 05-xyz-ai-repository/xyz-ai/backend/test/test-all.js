import { createApp } from '../src/app.js';

async function testAll() {
  console.log('================ PART 1: General Follow-up Test ================');
  const loginRes = await fetch('http://localhost:3001/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'student-001', role: 'student' }),
  });
  const { token } = await loginRes.json();

  console.log('\n--- Turn 1: "What is my attendance?" ---');
  const t1 = await fetch('http://localhost:3001/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'What is my attendance?' }),
  });
  const d1 = await t1.json();
  console.log('Turn 1 Response:', JSON.stringify(d1, null, 2));

  console.log('\n--- Turn 2: "What about last week specifically?" ---');
  const t2 = await fetch('http://localhost:3001/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'What about last week specifically?' }),
  });
  const d2 = await t2.json();
  console.log('Turn 2 Response:', JSON.stringify(d2, null, 2));

  console.log('\n================ PART 2: Multilingual Support Test ================');

  console.log('\n--- Hindi Test: "मेरी उपस्थिति क्या है?" (language: "hi") ---');
  const tHindi = await fetch('http://localhost:3001/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'मेरी उपस्थिति क्या है?', language: 'hi' }),
  });
  const dHindi = await tHindi.json();
  console.log('Hindi Response:', JSON.stringify(dHindi, null, 2));

  console.log('\n--- Kannada Test: "ನನ್ನ ಹಾಜರಾತಿ ಎಷ್ಟು?" (language: "kn") ---');
  const tKannada = await fetch('http://localhost:3001/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: 'ನನ್ನ ಹಾಜರಾತಿ ಎಷ್ಟು?', language: 'kn' }),
  });
  const dKannada = await tKannada.json();
  console.log('Kannada Response:', JSON.stringify(dKannada, null, 2));
}

testAll().catch(console.error);
