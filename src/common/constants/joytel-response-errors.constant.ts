export const JOYTEL_RESPONSE_ERRORS = [
  {
    code: '0',
    message: {
      en: 'Operation success',
      ru: 'Операция выполнена успешно',
      uz: 'Amaliyot muvaffaqiyatli bajarildi',
    },
  },
  {
    code: '1',
    message: {
      en: 'Request authentication failed',
      ru: 'Ошибка аутентификации запроса',
      uz: 'So‘rov autentifikatsiyasi muvaffaqiyatsiz tugadi',
    },
  },
  {
    code: '2',
    message: {
      en: 'Mandatory parameter missing',
      ru: 'Отсутствует обязательный параметр',
      uz: 'Majburiy parametr kiritilmagan',
    },
  },
  {
    code: '3',
    message: {
      en: 'Insufficient balance',
      ru: 'Недостаточно средств',
      uz: 'Balans yetarli emas',
    },
  },
  {
    code: '4',
    message: {
      en: 'Service not supported (reference the actual response message)',
      ru: 'Сервис не поддерживается (смотрите фактическое сообщение ответа)',
      uz: 'Xizmat qo‘llab-quvvatlanmaydi (haqiqiy javob xabariga qarang)',
    },
  },
  {
    code: '5',
    message: {
      en: 'Order already exists (check orderCode or orderTid to avoid duplicate)',
      ru: 'Заказ уже существует (проверьте orderCode или orderTid, чтобы избежать дубликата)',
      uz: 'Buyurtma allaqachon mavjud (dublikatdan qochish uchun orderCode yoki orderTid ni tekshiring)',
    },
  },
  {
    code: '6',
    message: {
      en: 'Order item exceeds limit (50)',
      ru: 'Элемент заказа превышает лимит (50)',
      uz: 'Buyurtma elementi limitdan oshib ketgan (50)',
    },
  },
  {
    code: '-1',
    message: {
      en: 'Request exceptions',
      ru: 'Исключение запроса',
      uz: 'So‘rov istisnosi',
    },
  },
  {
    code: '100000',
    message: {
      en: 'Unknown service exceptions',
      ru: 'Неизвестная ошибка сервиса',
      uz: 'Noma’lum xizmat xatosi',
    },
  },
];
