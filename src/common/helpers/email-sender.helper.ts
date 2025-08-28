// mail.helper.ts
import * as nodemailer from 'nodemailer';

export async function sendMailHelper(to: string, subject: string, text: string, html?: string) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"Jetsim" <${process.env.MAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });

  console.log('✅ Mail sent:', info.messageId);
  return info;
}

export function newOrderMessage(customerName: string, orderId: number, qrBase64: string, fasturl: string) {
  return `
  <!doctype html>
    <html>
      <body style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
        <p>Здравствуйте, ${customerName}!</p>
        <p>Ваш заказ <b>№${orderId}</b> готов ✅</p>

        <p style="margin:16px 0">QR-код для активации:</p>
        <p style="text-align:center">
          <img src="data:image/png;base64,${qrBase64}" alt="QR-код" width="280" style="display:block;margin:0 auto;border:0;"/>
        </p>

        <p style="margin:16px 0">
          Быстрая установка eSIM для Apple:  
          <a href="${fasturl}" target="_blank">${fasturl}</a>
        </p>
      </body>
  </html>
`;
}
