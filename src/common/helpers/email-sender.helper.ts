// mail.helper.ts
import * as nodemailer from 'nodemailer';
import { MAIL_PASS, MAIL_USER } from '@config';
console.log(MAIL_USER, MAIL_PASS);

export async function sendMailHelper(to: string, subject: string, text: string, html?: string, qrBuffer?: Buffer) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS,
    },
  });

  const mailOptions: any = {
    from: `"Jetsim" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  if (qrBuffer) {
    mailOptions.attachments = [
      {
        filename: 'qrcode.png',
        content: qrBuffer,
        cid: 'qrimage', // HTML ichida ishlatadigan ID
      },
    ];
  }

  const info = await transporter.sendMail(mailOptions);

  console.log('✅ Mail sent:', info.messageId);
  return info;
}

export function newOrderMessage(customerName: string, orderId: number, fasturl: string) {
  return `
  <!doctype html>
  <html>
    <body style="font-family:Arial,sans-serif;line-height:1.5;color:#222;background:#f6f9fc;padding:30px;">
      <table align="center" width="600" style="background:#ffffff;border-radius:12px;padding:30px;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        <tr>
          <td style="font-size:18px;color:#333;text-align:center;">
            <p>Здравствуйте, ${customerName}!</p>
            <p>Ваш заказ <b>№${orderId}</b> готов ✅</p>
          </td>
        </tr>

        <tr>
          <td style="font-size:16px;color:#555;text-align:center;padding:10px 0;">
            QR-код для активации:
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:20px;">
            <div style="border:2px dashed #ddd;display:inline-block;padding:20px;border-radius:10px;">
              <img src="cid:qrimage" alt="QR-код" width="240" style="display:block;margin:0 auto;"/>
            </div>
          </td>
        </tr>

        <tr>
          <td style="font-size:14px;color:#777;text-align:center;padding-top:20px;">
            Быстрая установка eSIM для Apple:  
            <br/>
            <a href="${fasturl}" target="_blank" style="color:#0066ff;text-decoration:none;">
              ${fasturl}
            </a>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;
}
