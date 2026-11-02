const loginRes = await fetch('http://127.0.0.1:4173/api/auth/login', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-requested-with': 'CloudCoreAI'
  },
  body: JSON.stringify({
    username: 'azeemniazi',
    password: 'fatimaarif'
  })
});

console.log('Login Status:', loginRes.status);
const setCookie = loginRes.headers.get('set-cookie');
console.log('Set-Cookie:', setCookie ? setCookie.split(';')[0] : 'None');
const cookie = setCookie ? setCookie.split(';')[0] : '';

const chatRes = await fetch('http://127.0.0.1:4173/api/chat', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-requested-with': 'CloudCoreAI',
    'cookie': cookie
  },
  body: JSON.stringify({
    message: 'Hello, what is 2 + 2?',
    use_rag: false
  })
});

console.log('Chat Status:', chatRes.status);
const chatData = await chatRes.json();
console.log('Chat Answer:', chatData.answer);
