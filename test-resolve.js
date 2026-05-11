const { resolveMirror } = require('./src/main/scraper/mirror-resolver');

async function test() {
  const url = 'https://filecrypt.cc/Container/3795B63872.html';
  console.log(`Testing resolution for: ${url}`);
  
  try {
    const result = await resolveMirror(url);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Test failed:', error);
  }
}

test();
