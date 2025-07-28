import * as nodemailer from 'nodemailer';

export class EmailSenderHelper {
  private static transporter = nodemailer.createTransport({
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  static async sendMail(to: string, subject: string, html: string) {
    try {
      const info = await this.transporter.sendMail({
        from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
        to,
        subject,
        html,
      });

      return info;
    } catch (error) {
      console.error('Email yuborishda xatolik:', error);
      throw new Error('Email yuborilmadi');
    }
  }
}
