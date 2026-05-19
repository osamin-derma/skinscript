// Country list with flag, name, and E.164 dial code.
//
// Middle East / North Africa is listed first because the bulk of the
// audience is taking the Arab Board exam.  After that, the rest of the
// world in roughly the order users are most likely to come from.
//
// Adding a new country?  Just append to `COUNTRIES`.  The component
// sorts by relevance + searches by name OR dial code.

export const COUNTRIES = [
  // ── Gulf & Middle East (Iraq + Qatar pinned to the top) ───────
  { code: 'IQ', name: 'Iraq',                 dial: '964', flag: '🇮🇶' },
  { code: 'QA', name: 'Qatar',                dial: '974', flag: '🇶🇦' },
  { code: 'SA', name: 'Saudi Arabia',         dial: '966', flag: '🇸🇦' },
  { code: 'AE', name: 'United Arab Emirates', dial: '971', flag: '🇦🇪' },
  { code: 'KW', name: 'Kuwait',               dial: '965', flag: '🇰🇼' },
  { code: 'BH', name: 'Bahrain',              dial: '973', flag: '🇧🇭' },
  { code: 'OM', name: 'Oman',                 dial: '968', flag: '🇴🇲' },
  { code: 'YE', name: 'Yemen',                dial: '967', flag: '🇾🇪' },
  { code: 'JO', name: 'Jordan',               dial: '962', flag: '🇯🇴' },
  { code: 'SY', name: 'Syria',                dial: '963', flag: '🇸🇾' },
  { code: 'LB', name: 'Lebanon',              dial: '961', flag: '🇱🇧' },
  { code: 'PS', name: 'Palestine',            dial: '970', flag: '🇵🇸' },
  { code: 'IL', name: 'Israel',               dial: '972', flag: '🇮🇱' },

  // ── North Africa ──────────────────────────────────────────────
  { code: 'EG', name: 'Egypt',                dial: '20',  flag: '🇪🇬' },
  { code: 'LY', name: 'Libya',                dial: '218', flag: '🇱🇾' },
  { code: 'TN', name: 'Tunisia',              dial: '216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algeria',              dial: '213', flag: '🇩🇿' },
  { code: 'MA', name: 'Morocco',              dial: '212', flag: '🇲🇦' },
  { code: 'SD', name: 'Sudan',                dial: '249', flag: '🇸🇩' },
  { code: 'MR', name: 'Mauritania',           dial: '222', flag: '🇲🇷' },
  { code: 'SO', name: 'Somalia',              dial: '252', flag: '🇸🇴' },

  // ── Rest of the world (popular destinations) ──────────────────
  { code: 'TR', name: 'Turkey',               dial: '90',  flag: '🇹🇷' },
  { code: 'IR', name: 'Iran',                 dial: '98',  flag: '🇮🇷' },
  { code: 'PK', name: 'Pakistan',             dial: '92',  flag: '🇵🇰' },
  { code: 'IN', name: 'India',                dial: '91',  flag: '🇮🇳' },
  { code: 'BD', name: 'Bangladesh',           dial: '880', flag: '🇧🇩' },
  { code: 'AF', name: 'Afghanistan',          dial: '93',  flag: '🇦🇫' },
  { code: 'ID', name: 'Indonesia',            dial: '62',  flag: '🇮🇩' },
  { code: 'MY', name: 'Malaysia',             dial: '60',  flag: '🇲🇾' },
  { code: 'PH', name: 'Philippines',          dial: '63',  flag: '🇵🇭' },
  { code: 'CN', name: 'China',                dial: '86',  flag: '🇨🇳' },
  { code: 'JP', name: 'Japan',                dial: '81',  flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea',          dial: '82',  flag: '🇰🇷' },

  { code: 'US', name: 'United States',        dial: '1',   flag: '🇺🇸' },
  { code: 'CA', name: 'Canada',               dial: '1',   flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom',       dial: '44',  flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland',              dial: '353', flag: '🇮🇪' },
  { code: 'DE', name: 'Germany',              dial: '49',  flag: '🇩🇪' },
  { code: 'FR', name: 'France',               dial: '33',  flag: '🇫🇷' },
  { code: 'IT', name: 'Italy',                dial: '39',  flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',                dial: '34',  flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands',          dial: '31',  flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium',              dial: '32',  flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland',          dial: '41',  flag: '🇨🇭' },
  { code: 'AT', name: 'Austria',              dial: '43',  flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden',               dial: '46',  flag: '🇸🇪' },
  { code: 'NO', name: 'Norway',               dial: '47',  flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark',              dial: '45',  flag: '🇩🇰' },
  { code: 'FI', name: 'Finland',              dial: '358', flag: '🇫🇮' },
  { code: 'PL', name: 'Poland',               dial: '48',  flag: '🇵🇱' },
  { code: 'RU', name: 'Russia',               dial: '7',   flag: '🇷🇺' },
  { code: 'UA', name: 'Ukraine',              dial: '380', flag: '🇺🇦' },
  { code: 'GR', name: 'Greece',               dial: '30',  flag: '🇬🇷' },
  { code: 'PT', name: 'Portugal',             dial: '351', flag: '🇵🇹' },
  { code: 'RO', name: 'Romania',              dial: '40',  flag: '🇷🇴' },

  { code: 'AU', name: 'Australia',            dial: '61',  flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand',          dial: '64',  flag: '🇳🇿' },
  { code: 'ZA', name: 'South Africa',         dial: '27',  flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria',              dial: '234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya',                dial: '254', flag: '🇰🇪' },
  { code: 'ET', name: 'Ethiopia',             dial: '251', flag: '🇪🇹' },
  { code: 'GH', name: 'Ghana',                dial: '233', flag: '🇬🇭' },

  { code: 'MX', name: 'Mexico',               dial: '52',  flag: '🇲🇽' },
  { code: 'BR', name: 'Brazil',               dial: '55',  flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina',            dial: '54',  flag: '🇦🇷' },
  { code: 'CL', name: 'Chile',                dial: '56',  flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia',             dial: '57',  flag: '🇨🇴' },
]

export const DEFAULT_COUNTRY_CODE = 'IQ'   // Iraq default

export function findCountry(code) {
  return COUNTRIES.find(c => c.code === code) || COUNTRIES[0]
}
