export function generateFastEsimInstallmentString(qrCodeContent: string) {
  return `https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=${qrCodeContent}`;
}
