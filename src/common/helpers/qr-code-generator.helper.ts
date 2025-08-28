import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import Jimp from 'jimp';

@Injectable()
export class QrService {
  async generateQrWithLogo(text: string): Promise<Buffer> {
    const qrImage = await QRCode.toBuffer(text, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 400,
      margin: 2,
    });

    const qr = await Jimp.read(qrImage);
    const logo = await Jimp.read('uploads/logo.png');

    logo.resize(qr.bitmap.width / 4, qr.bitmap.width / 4);

    const x = qr.bitmap.width / 2 - logo.bitmap.width / 2;
    const y = qr.bitmap.height / 2 - logo.bitmap.height / 2;

    // ✅ Logo ni joylash
    qr.composite(logo, x, y);

    // ✅ Async usuli bilan olish (callback kerak emas)
    return qr.getBufferAsync('image/png');
  }
}
