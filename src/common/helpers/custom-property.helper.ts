export {};

declare global {
  interface String {
    reverseDate(replace?: string, text?: string): string;
    formatRegex(pattern: string): string;
    maskedPhone(): string;
    maskedPan(): string;
    formatForRegex(pattern: string): string;
  }
  interface Number {
    summaFormatted(currency?: string): string;
    summaFormattedFixed(fixed: number, currency?: string): string;
  }
  interface Date {
    dateToLong(lang: string): string;
    timeToLong(): string;
  }
}

String.prototype.reverseDate = function (replace = '-', text = '.'): string {
  return this.split(replace).reverse().join(text);
};

Number.prototype.summaFormatted = function (currency: string = 'UZS'): string {
  return Math.round(this / 100).toLocaleString('uz') + (currency == '' ? '' : ` ${currency}`);
};

Number.prototype.summaFormattedFixed = function (fixed: number = 2, currency: string = 'UZS'): string {
  return parseFloat((this / 100).toFixed(fixed)).toLocaleString('uz') + (currency == '' ? '' : ` ${currency}`);
};

String.prototype.formatRegex = function (pattern: string): string {
  let i = 0;
  const v = this?.toString();
  return pattern.replace(/#/g, (_) => v[i++]);
};

String.prototype.formatForRegex = function (pattern: string) {
  let i = 0;
  const v = this.replaceAll(/T|Z|-/g, '').toString();
  return pattern.replace(/#/g, (_) => v[i++]);
};

String.prototype.maskedPhone = function () {
  return `+998 ** *** ${this.slice(-4)}`;
};

String.prototype.maskedPan = function () {
  return `${this.slice(0, 4)} **** **** ${this.slice(-4)}`;
};

Date.prototype.dateToLong = function (lang: string): string {
  return this.toLocaleString(lang, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

Date.prototype.timeToLong = function (): string {
  return this.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
};
