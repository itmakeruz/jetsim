// mail.helper.ts
import * as nodemailer from 'nodemailer';
import { MAIL_PASS, MAIL_USER } from '@config';
console.log(MAIL_USER, MAIL_PASS);

export async function sendMailHelper(to: string, subject: string, text: string, html?: string, qrBuffer?: Buffer) {
  const transporter = nodemailer.createTransport({
    host: 'mail.jetsim.ru',
    port: 465,
    secure: true,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const mailOptions: any = {
    from: `"Jetsim" <${MAIL_USER}>`,
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

export function newOrderMessage(
  customerName: string,
  orderId: number,
  fasturl: string,
  tariffName: string,
  dataMb: number,
  minutes: number,
  sms: number,
) {
  return `
  <!doctype html>
  <html>
    <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f7fb">
      <div style="max-width:650px;margin:40px auto;background:#fff;padding:30px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="text-align:center;border-bottom:2px solid #f0f0f0;padding-bottom:20px;margin-bottom:20px">
          <h2 style="margin:0;color:#222">Здравствуйте, ${customerName} 👋</h2>
          <p style="margin:8px 0 0;font-size:15px;color:#666">
            Ваш заказ <b>№${orderId}</b> готов
          </p>
        </div>

        <!-- Tariff details -->
        <h3 style="margin:0 0 16px;color:#444;font-size:18px">📦 Детали тарифа</h3>
        <table style="width:100%;border-collapse:collapse;font-size:15px;margin-bottom:28px">
          <tr style="background:#f9fafc">
            <td style="padding:10px 12px;border:1px solid #eee">Тариф</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${tariffName}</b></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #eee">Интернет</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${dataMb} MB</b></td>
          </tr>
          <tr style="background:#f9fafc">
            <td style="padding:10px 12px;border:1px solid #eee">Минуты</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${minutes}</b></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #eee">SMS</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${sms}</b></td>
          </tr>
        </table>

        <!-- QR Code -->
        <div style="text-align:center;margin:24px 0">
          <p style="font-size:15px;margin-bottom:12px;color:#444">QR-код для активации:</p>
          <img src="cid:qrimage" alt="QR-код" width="280" style="display:block;margin:0 auto;border:0;"/>
        </div>

        <!-- Fast URL -->
        <div style="margin-top:28px;text-align:center">
          <p style="margin-bottom:12px;font-size:15px;color:#444">Быстрая установка eSIM для Apple:</p>
          <p style="margin-top:12px;font-size:14px;color:#666">${fasturl}</p>
        </div>

      </div>
    </body>
  </html>
  `;
}
