import fs from 'fs';
import path from 'path';

async function testGroq() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const groqMatch = envContent.match(/GROQ_API_KEY=(.+)/);
  const groqKey = groqMatch ? groqMatch[1].trim() : process.env.GROQ_API_KEY;

  if (!groqKey) {
    console.log('GROQ_API_KEY is missing');
    return;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', // one of the latest fast Groq models
        messages: [{role: 'user', content: 'test'}],
        max_tokens: 10
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('GROQ API: SUCCESS');
    } else {
      console.log(`GROQ API: FAILED - ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`GROQ API: FAILED - ${e.message}`);
  }
}

async function testGemini() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const geminiMatch = envContent.match(/GEMINI_API_KEY=(.+)/);
  const geminiKey = geminiMatch ? geminiMatch[1].trim() : process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    console.log('GEMINI_API_KEY is missing');
    return;
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{parts: [{text: 'test'}]}]
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('GEMINI API: SUCCESS');
    } else {
      console.log(`GEMINI API: FAILED - ${JSON.stringify(data)}`);
    }
  } catch (e) {
    console.log(`GEMINI API: FAILED - ${e.message}`);
  }
}

async function main() {
  await testGroq();
  await testGemini();
}

main();
