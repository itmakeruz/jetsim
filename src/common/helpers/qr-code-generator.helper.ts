import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
const sharp: typeof import('sharp').default = require('sharp');

@Injectable()
export class QrService {
  async generateQrWithLogo(text: string): Promise<Buffer> {
    const qr = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H', type: 'png', width: 400, margin: 2,
    });
    const logo = await sharp('logo_image/logo.png').resize(100, 100, { fit: 'fill' }).png().toBuffer();
    return sharp(qr).composite([{ input: logo, left: 150, top: 150 }]).png().toBuffer();
  }
}
