import { QrService } from '../common/helpers/qr-code-generator.helper';
const sharp: typeof import('sharp').default = require('sharp');
describe('private QR image generation',()=>{
 it('produces a valid PNG with the existing branded layout',async()=>{
  const buffer=await new QrService().generateQrWithLogo('LPA:1$synthetic.example.invalid$synthetic');
  const meta=await sharp(buffer).metadata();
  expect(meta.format).toBe('png');expect(meta.width).toBe(400);expect(meta.height).toBe(400);
 });
});
