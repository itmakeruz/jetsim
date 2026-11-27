import * as nodemailer from 'nodemailer';
import { sendEsimReadyMail } from '../common/helpers/email-sender.helper';
jest.mock('nodemailer',()=>({createTransport:jest.fn()}));
describe('private eSIM email',()=>{
 it('attaches the QR and never exposes a public file URL',async()=>{
  const sendMail=jest.fn().mockResolvedValue({messageId:'synthetic'});
  (nodemailer.createTransport as jest.Mock).mockReturnValue({sendMail});
  const qr=Buffer.from('synthetic PNG');
  await sendEsimReadyMail('test@example.invalid',42,qr);
  expect(sendMail.mock.calls[0][0].attachments[0].content).toEqual(qr);
  expect(sendMail.mock.calls[0][0].html).not.toContain('/uploads/');
  expect((nodemailer.createTransport as jest.Mock).mock.calls[0][0].tls.rejectUnauthorized).toBe(true);
 });
});
