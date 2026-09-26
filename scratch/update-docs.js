import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/XAI_API_KEY/g, 'GROQ_API_KEY');
  content = content.replace(/XAI_CHAT_MODEL/g, 'GROQ_CHAT_MODEL');
  content = content.replace(/XAI_BASE_URL/g, 'GROQ_BASE_URL');
  content = content.replace(/xAI/g, 'Groq');
  content = content.replace(/Grok/g, 'Groq');
  content = content.replace(/grok-4\.5/g, 'llama-3.3-70b-versatile');
  content = content.replace(/api\.x\.ai/g, 'api.groq.com');
  content = content.replace(/gemini-2\.0-flash/g, 'gemini-1.5-flash');
  fs.writeFileSync(filePath, content, 'utf-8');
}

replaceInFile('README.md');
replaceInFile('MANUAL_SETUP.md');
console.log('Docs updated.');
