import { redact } from './redact';
describe('sensitive log redaction',()=>{
 it('redacts nested provider credentials and activation codes',()=>{
  const result=redact({ qrcode:'LPA:1$secret', data:{ coupon:'code', pin_1:'1234', group_key:'test-key', accessToken:'test-token' } });
  expect(result.qrcode).toBe('[REDACTED]');
  expect(result.data.coupon).toBe('[REDACTED]');
  expect(result.data.pin_1).toBe('[REDACTED]');
  expect(result.data.accessToken).toBe('[REDACTED]');
 });
 it('redacts strings and does not serialize error response bodies',()=>{
  expect(redact('LPA:1$server$secret')).not.toContain('$secret');
  const error:any=new Error('private bank response');error.response={password:'secret'};
  expect(JSON.stringify(redact(error))).not.toContain('secret');
 });
});

it('removes configured secrets and Telegram credentials from diagnostic strings',()=>{
 process.env.SECURITY_TEST_API_KEY='synthetic-api-key';
 try { expect(redact('https://api.telegram.org/bot123:synthetic/sendMessage synthetic-api-key')).not.toContain('synthetic'); }
 finally {delete process.env.SECURITY_TEST_API_KEY;}
});
