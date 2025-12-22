import * as nodemailer from 'nodemailer';
import { MAIL_PASS, MAIL_USER } from '@config';
import axios from 'axios';

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
  pin1: string,
  pin2: string,
  puk1: string,
  puk2: string,
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
          <tr style="background:#f9fafc">
            <td style="padding:10px 12px;border:1px solid #eee">PIN1</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${pin1}</b></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #eee">PIN2</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${pin2}</b></td>
          </tr>
          <tr style="background:#f9fafc">
            <td style="padding:10px 12px;border:1px solid #eee">PUK1</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${puk1}</b></td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border:1px solid #eee">PUK2</td>
            <td style="padding:10px 12px;border:1px solid #eee"><b>${puk2}</b></td>
          </tr>
        </table>

        <!-- Fast URL -->
        <div style="margin-top:28px;text-align:center">
          <p style="margin-bottom:12px;font-size:15px;color:#444; text-align:center;">
            <a href="${fasturl}" style="color:#1a73e8; text-decoration:none;" target="_blank">
              Быстрая установка eSIM для Apple
            </a>
          </p>
        </div>
      </div>
    </body>
  </html>
  `;
}

export function otpEmailTemplate(userEmail: string, otp: string, ttlMinutes: number): string {
  return `
  <!doctype html>
  <html>
    <body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#333;margin:0;padding:0;background:#f5f7fb">
      <div style="max-width:650px;margin:40px auto;background:#fff;padding:30px;border-radius:16px;box-shadow:0 4px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <div style="text-align:center;border-bottom:2px solid #f0f0f0;padding-bottom:20px;margin-bottom:20px">
          <h2 style="margin:0;color:#222">Здравствуйте, ${userEmail} 👋</h2>
          <p style="margin:8px 0 0;font-size:15px;color:#666">
            Ваш одноразовый пароль (OTP) готов!
          </p>
        </div>

        <!-- OTP Details -->
        <h3 style="margin:0 0 16px;color:#444;font-size:18px">🔑 Ваш OTP код</h3>
        <div style="text-align:center;margin:24px 0">
          <p style="font-size:24px;font-weight:bold;color:#222;letter-spacing:2px;padding:12px;background:#f9fafc;border-radius:8px">
            ${otp}
          </p>
          <p style="font-size:15px;color:#666;margin-top:12px">
            Этот код действителен в течение <b>${ttlMinutes} минут</b>.
          </p>
        </div>

        <!-- Instructions -->
        <div style="margin-top:28px;">
          <p style="font-size:15px;color:#444;margin-bottom:12px">
            Пожалуйста, не делитесь этим OTP кодом ни с кем. Используйте его только для подтверждения.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align:center;margin-top:28px;padding-top:20px;border-top:2px solid #f0f0f0">
          <p style="font-size:14px;color:#666;margin:0">
            &copy; ${new Date().getFullYear()} Jetsim. Все права защищены.
          </p>
        </div>

      </div>
    </body>
  </html>
  `;
}

export function sendOtpFromAnotherService(userEmail: string, otpCode: string, ttlMinutes: number) {
  return axios.post('http://80.78.242.23:4000/mail/send-otp', {
    userEmail,
    otpCode,
    ttlMinutes,
  });
}
