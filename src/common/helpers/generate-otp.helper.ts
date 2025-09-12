import * as crypto from 'crypto';

/**
 * Generates a random OTP of specified length using crypto for secure randomness.
 * @param length - The length of the OTP (default: 6)
 * @returns A string of random digits
 */
export function generateOtp(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';

  // Har bir raqam uchun tasodifiy indeks tanlaymiz
  for (let i = 0; i < length; i++) {
    // crypto.randomInt(0, 10) 0-9 oralig‘ida tasodifiy raqam qaytaradi
    const randomIndex = crypto.randomInt(0, digits.length);
    otp += digits[randomIndex];
  }

  return otp;
}
