/**
 * ISO 3166-1 alpha-2. Таблица нужна для разовой расстановки кодов у существующих регионов (scripts/backfill-region-iso.ts)
 * и для проверки кода при создании/редактировании региона. Источник правды — поле region.iso_code.
 */
const RAW =
  'AF:Afghanistan|AX:Aland Islands|AL:Albania|DZ:Algeria|AS:American Samoa|AD:Andorra|AO:Angola|AI:Anguilla|AQ:Antarctica|' +
  'AG:Antigua and Barbuda|AR:Argentina|AM:Armenia|AW:Aruba|AU:Australia|AT:Austria|AZ:Azerbaijan|BS:Bahamas|BH:Bahrain|' +
  'BD:Bangladesh|BB:Barbados|BY:Belarus|BE:Belgium|BZ:Belize|BJ:Benin|BM:Bermuda|BT:Bhutan|BO:Bolivia|' +
  'BQ:Bonaire, Sint Eustatius and Saba|BA:Bosnia and Herzegovina|BW:Botswana|BV:Bouvet Island|BR:Brazil|' +
  'IO:British Indian Ocean Territory|BN:Brunei|BG:Bulgaria|BF:Burkina Faso|BI:Burundi|CV:Cape Verde|KH:Cambodia|' +
  'CM:Cameroon|CA:Canada|KY:Cayman Islands|CF:Central African Republic|TD:Chad|CL:Chile|CN:China|CX:Christmas Island|' +
  'CC:Cocos Islands|CO:Colombia|KM:Comoros|CG:Congo|CD:DR Congo|CK:Cook Islands|CR:Costa Rica|CI:Cote d\'Ivoire|' +
  'HR:Croatia|CU:Cuba|CW:Curacao|CY:Cyprus|CZ:Czech Republic|DK:Denmark|DJ:Djibouti|DM:Dominica|DO:Dominican Republic|' +
  'EC:Ecuador|EG:Egypt|SV:El Salvador|GQ:Equatorial Guinea|ER:Eritrea|EE:Estonia|SZ:Eswatini|ET:Ethiopia|' +
  'FK:Falkland Islands|FO:Faroe Islands|FJ:Fiji|FI:Finland|FR:France|GF:French Guiana|PF:French Polynesia|' +
  'TF:French Southern Territories|GA:Gabon|GM:Gambia|GE:Georgia|DE:Germany|GH:Ghana|GI:Gibraltar|GR:Greece|' +
  'GL:Greenland|GD:Grenada|GP:Guadeloupe|GU:Guam|GT:Guatemala|GG:Guernsey|GN:Guinea|GW:Guinea-Bissau|GY:Guyana|' +
  'HT:Haiti|HM:Heard Island and McDonald Islands|VA:Vatican City|HN:Honduras|HK:Hong Kong|HU:Hungary|IS:Iceland|' +
  'IN:India|ID:Indonesia|IR:Iran|IQ:Iraq|IE:Ireland|IM:Isle of Man|IL:Israel|IT:Italy|JM:Jamaica|JP:Japan|JE:Jersey|' +
  'JO:Jordan|KZ:Kazakhstan|KE:Kenya|KI:Kiribati|KP:North Korea|KR:South Korea|XK:Kosovo|KW:Kuwait|KG:Kyrgyzstan|' +
  'LA:Laos|LV:Latvia|LB:Lebanon|LS:Lesotho|LR:Liberia|LY:Libya|LI:Liechtenstein|LT:Lithuania|LU:Luxembourg|MO:Macao|' +
  'MG:Madagascar|MW:Malawi|MY:Malaysia|MV:Maldives|ML:Mali|MT:Malta|MH:Marshall Islands|MQ:Martinique|MR:Mauritania|' +
  'MU:Mauritius|YT:Mayotte|MX:Mexico|FM:Micronesia|MD:Moldova|MC:Monaco|MN:Mongolia|ME:Montenegro|MS:Montserrat|' +
  'MA:Morocco|MZ:Mozambique|MM:Myanmar|NA:Namibia|NR:Nauru|NP:Nepal|NL:Netherlands|NC:New Caledonia|NZ:New Zealand|' +
  'NI:Nicaragua|NE:Niger|NG:Nigeria|NU:Niue|NF:Norfolk Island|MK:North Macedonia|MP:Northern Mariana Islands|' +
  'NO:Norway|OM:Oman|PK:Pakistan|PW:Palau|PS:Palestine|PA:Panama|PG:Papua New Guinea|PY:Paraguay|PE:Peru|' +
  'PH:Philippines|PN:Pitcairn|PL:Poland|PT:Portugal|PR:Puerto Rico|QA:Qatar|RE:Reunion|RO:Romania|RU:Russia|' +
  'RW:Rwanda|BL:Saint Barthelemy|SH:Saint Helena|KN:Saint Kitts and Nevis|LC:Saint Lucia|MF:Saint Martin|' +
  'PM:Saint Pierre and Miquelon|VC:Saint Vincent and the Grenadines|WS:Samoa|SM:San Marino|ST:Sao Tome and Principe|' +
  'SA:Saudi Arabia|SN:Senegal|RS:Serbia|SC:Seychelles|SL:Sierra Leone|SG:Singapore|SX:Sint Maarten|SK:Slovakia|' +
  'SI:Slovenia|SB:Solomon Islands|SO:Somalia|ZA:South Africa|GS:South Georgia and the South Sandwich Islands|' +
  'SS:South Sudan|ES:Spain|LK:Sri Lanka|SD:Sudan|SR:Suriname|SJ:Svalbard and Jan Mayen|SE:Sweden|CH:Switzerland|' +
  'SY:Syria|TW:Taiwan|TJ:Tajikistan|TZ:Tanzania|TH:Thailand|TL:Timor-Leste|TG:Togo|TK:Tokelau|TO:Tonga|' +
  'TT:Trinidad and Tobago|TN:Tunisia|TR:Turkey|TM:Turkmenistan|TC:Turks and Caicos Islands|TV:Tuvalu|UG:Uganda|' +
  'UA:Ukraine|AE:United Arab Emirates|GB:United Kingdom|US:United States|UM:United States Minor Outlying Islands|' +
  'UY:Uruguay|UZ:Uzbekistan|VU:Vanuatu|VE:Venezuela|VN:Vietnam|VG:British Virgin Islands|VI:US Virgin Islands|' +
  'WF:Wallis and Futuna|EH:Western Sahara|YE:Yemen|ZM:Zambia|ZW:Zimbabwe';

/** Распространённые альтернативные написания → ISO-код. */
const ALIASES: Record<string, string> = {
  usa: 'US', 'united states of america': 'US', america: 'US', uk: 'GB', 'great britain': 'GB', britain: 'GB',
  england: 'GB', uae: 'AE', emirates: 'AE', czechia: 'CZ', 'republic of korea': 'KR', korea: 'KR',
  'russian federation': 'RU', 'viet nam': 'VN', 'cote divoire': 'CI', 'ivory coast': 'CI', turkiye: 'TR',
  swaziland: 'SZ', burma: 'MM', 'cabo verde': 'CV', macau: 'MO', 'timor leste': 'TL', 'east timor': 'TL',
  'democratic republic of the congo': 'CD', 'republic of the congo': 'CG', 'north macedonia': 'MK',
  macedonia: 'MK', 'holy see': 'VA', vatican: 'VA', 'palestinian territories': 'PS', 'brunei darussalam': 'BN',
  'the netherlands': 'NL', holland: 'NL', 'the bahamas': 'BS', 'the gambia': 'GM', 'virgin islands': 'VG',
  'st kitts and nevis': 'KN', 'st lucia': 'LC', 'saint vincent': 'VC', 'curaçao': 'CW',
};

const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const BY_NAME = new Map<string, string>();
for (const item of RAW.split('|')) {
  const i = item.indexOf(':');
  BY_NAME.set(normalize(item.slice(i + 1)), item.slice(0, i));
}
for (const [name, code] of Object.entries(ALIASES)) BY_NAME.set(normalize(name), code);

const ISO2 = /^[A-Za-z]{2}$/;

/** Нормализует код, пришедший из центра: два латинских символа в верхнем регистре, иначе null. */
export const normalizeIso = (code: unknown): string | null =>
  typeof code === 'string' && ISO2.test(code.trim()) ? code.trim().toUpperCase() : null;

/** ISO 3166-1 alpha-2 по английскому названию страны; null, если это не страна или название не распознано. */
export const isoByEnglishName = (nameEn: unknown): string | null =>
  typeof nameEn === 'string' ? (BY_NAME.get(normalize(nameEn)) ?? null) : null;

/** Код региона: сначала то, что отдал центр, затем подбор по названию. */
export const resolveIso = (region: { iso_code?: unknown; name_en?: unknown }): string | null =>
  normalizeIso(region.iso_code) ?? isoByEnglishName(region.name_en);
