const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const TelegramBot=require('node-telegram-bot-api');
test('Cypress transport preserves Telegram JSON and multipart operations without provider calls',async()=>{
 const received=[];
 const server=http.createServer((req,res)=>{
  const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{
   received.push({url:req.url,contentType:req.headers['content-type'],body:Buffer.concat(chunks).toString()});
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:true,result:{message_id:123}}));
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {
  const bot=new TelegramBot('synthetic-test-token',{polling:false,baseApiUrl:'http://127.0.0.1:'+server.address().port});
  assert.equal((await bot.sendMessage('1','synthetic message')).message_id,123);
  assert.equal((await bot.sendPhoto('1',Buffer.from('synthetic PNG'),{}, {filename:'qr.png',contentType:'image/png'})).message_id,123);
  assert.match(received[0].body,/synthetic/);assert.match(received[1].contentType,/multipart/);assert.match(received[1].body,/synthetic PNG/);
 }finally {await new Promise(r=>server.close(r));}
});
