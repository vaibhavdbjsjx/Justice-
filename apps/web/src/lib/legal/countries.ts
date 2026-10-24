/**
 * Jurisdiction reference data. Global architecture: full subdivisions for the
 * initial focus markets (US, CA, GB, AU, IN) for precise scoping, plus every
 * other country/territory (ISO 3166-1, generated) so the app is usable almost
 * everywhere. Non-focus regions capture the state/province free-form.
 */

export type Subdivision = { code: string; name: string };
export type Country = {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  subdivisionLabel?: string;
  subdivisions?: Subdivision[];
};

const US_STATES: Subdivision[] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],
  ["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],
  ["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],
  ["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],
  ["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],
  ["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],
  ["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],
  ["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],
  ["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],
  ["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
].map(([code, name]) => ({ code, name }));

const CA_PROVINCES: Subdivision[] = [
  ["AB","Alberta"],["BC","British Columbia"],["MB","Manitoba"],["NB","New Brunswick"],
  ["NL","Newfoundland and Labrador"],["NS","Nova Scotia"],["NT","Northwest Territories"],
  ["NU","Nunavut"],["ON","Ontario"],["PE","Prince Edward Island"],["QC","Quebec"],
  ["SK","Saskatchewan"],["YT","Yukon"],
].map(([code, name]) => ({ code, name }));

const AU_STATES: Subdivision[] = [
  ["ACT","Australian Capital Territory"],["NSW","New South Wales"],["NT","Northern Territory"],
  ["QLD","Queensland"],["SA","South Australia"],["TAS","Tasmania"],["VIC","Victoria"],
  ["WA","Western Australia"],
].map(([code, name]) => ({ code, name }));

const IN_STATES: Subdivision[] = [
  ["AP","Andhra Pradesh"],["AR","Arunachal Pradesh"],["AS","Assam"],["BR","Bihar"],
  ["CT","Chhattisgarh"],["DL","Delhi"],["GA","Goa"],["GJ","Gujarat"],["HR","Haryana"],
  ["HP","Himachal Pradesh"],["JH","Jharkhand"],["KA","Karnataka"],["KL","Kerala"],
  ["MP","Madhya Pradesh"],["MH","Maharashtra"],["MN","Manipur"],["ML","Meghalaya"],
  ["MZ","Mizoram"],["NL","Nagaland"],["OR","Odisha"],["PB","Punjab"],["RJ","Rajasthan"],
  ["SK","Sikkim"],["TN","Tamil Nadu"],["TG","Telangana"],["TR","Tripura"],
  ["UP","Uttar Pradesh"],["UK","Uttarakhand"],["WB","West Bengal"],
].map(([code, name]) => ({ code, name }));

const GB_NATIONS: Subdivision[] = [
  { code: "ENG", name: "England" }, { code: "SCT", name: "Scotland" },
  { code: "WLS", name: "Wales" }, { code: "NIR", name: "Northern Ireland" },
];

// Focus markets (with subdivisions) first, then the rest of the world alphabetically.
export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", subdivisionLabel: "State", subdivisions: US_STATES },
  { code: "CA", name: "Canada", subdivisionLabel: "Province / Territory", subdivisions: CA_PROVINCES },
  { code: "GB", name: "United Kingdom", subdivisionLabel: "Nation", subdivisions: GB_NATIONS },
  { code: "AU", name: "Australia", subdivisionLabel: "State / Territory", subdivisions: AU_STATES },
  { code: "IN", name: "India", subdivisionLabel: "State / UT", subdivisions: IN_STATES },
  { code: "AF", name: "Afghanistan" }, { code: "AX", name: "Åland Islands" }, { code: "AL", name: "Albania" },
  { code: "DZ", name: "Algeria" }, { code: "AS", name: "American Samoa" }, { code: "AD", name: "Andorra" },
  { code: "AO", name: "Angola" }, { code: "AI", name: "Anguilla" }, { code: "AQ", name: "Antarctica" },
  { code: "AG", name: "Antigua & Barbuda" }, { code: "AR", name: "Argentina" }, { code: "AM", name: "Armenia" },
  { code: "AW", name: "Aruba" }, { code: "AT", name: "Austria" }, { code: "AZ", name: "Azerbaijan" },
  { code: "BS", name: "Bahamas" }, { code: "BH", name: "Bahrain" }, { code: "BD", name: "Bangladesh" },
  { code: "BB", name: "Barbados" }, { code: "BY", name: "Belarus" }, { code: "BE", name: "Belgium" },
  { code: "BZ", name: "Belize" }, { code: "BJ", name: "Benin" }, { code: "BM", name: "Bermuda" },
  { code: "BT", name: "Bhutan" }, { code: "BO", name: "Bolivia" }, { code: "BA", name: "Bosnia & Herzegovina" },
  { code: "BW", name: "Botswana" }, { code: "BV", name: "Bouvet Island" }, { code: "BR", name: "Brazil" },
  { code: "IO", name: "British Indian Ocean Territory" }, { code: "VG", name: "British Virgin Islands" }, { code: "BN", name: "Brunei" },
  { code: "BG", name: "Bulgaria" }, { code: "BF", name: "Burkina Faso" }, { code: "BI", name: "Burundi" },
  { code: "KH", name: "Cambodia" }, { code: "CM", name: "Cameroon" }, { code: "CV", name: "Cape Verde" },
  { code: "BQ", name: "Caribbean Netherlands" }, { code: "KY", name: "Cayman Islands" }, { code: "CF", name: "Central African Republic" },
  { code: "TD", name: "Chad" }, { code: "CL", name: "Chile" }, { code: "CN", name: "China" },
  { code: "CX", name: "Christmas Island" }, { code: "CC", name: "Cocos (Keeling) Islands" }, { code: "CO", name: "Colombia" },
  { code: "KM", name: "Comoros" }, { code: "CG", name: "Congo - Brazzaville" }, { code: "CD", name: "Congo - Kinshasa" },
  { code: "CK", name: "Cook Islands" }, { code: "CR", name: "Costa Rica" }, { code: "CI", name: "Côte d’Ivoire" },
  { code: "HR", name: "Croatia" }, { code: "CU", name: "Cuba" }, { code: "CW", name: "Curaçao" },
  { code: "CY", name: "Cyprus" }, { code: "CZ", name: "Czechia" }, { code: "DK", name: "Denmark" },
  { code: "DJ", name: "Djibouti" }, { code: "DM", name: "Dominica" }, { code: "DO", name: "Dominican Republic" },
  { code: "EC", name: "Ecuador" }, { code: "EG", name: "Egypt" }, { code: "SV", name: "El Salvador" },
  { code: "GQ", name: "Equatorial Guinea" }, { code: "ER", name: "Eritrea" }, { code: "EE", name: "Estonia" },
  { code: "SZ", name: "Eswatini" }, { code: "ET", name: "Ethiopia" }, { code: "FK", name: "Falkland Islands" },
  { code: "FO", name: "Faroe Islands" }, { code: "FJ", name: "Fiji" }, { code: "FI", name: "Finland" },
  { code: "FR", name: "France" }, { code: "GF", name: "French Guiana" }, { code: "PF", name: "French Polynesia" },
  { code: "TF", name: "French Southern Territories" }, { code: "GA", name: "Gabon" }, { code: "GM", name: "Gambia" },
  { code: "GE", name: "Georgia" }, { code: "DE", name: "Germany" }, { code: "GH", name: "Ghana" },
  { code: "GI", name: "Gibraltar" }, { code: "GR", name: "Greece" }, { code: "GL", name: "Greenland" },
  { code: "GD", name: "Grenada" }, { code: "GP", name: "Guadeloupe" }, { code: "GU", name: "Guam" },
  { code: "GT", name: "Guatemala" }, { code: "GG", name: "Guernsey" }, { code: "GN", name: "Guinea" },
  { code: "GW", name: "Guinea-Bissau" }, { code: "GY", name: "Guyana" }, { code: "HT", name: "Haiti" },
  { code: "HM", name: "Heard & McDonald Islands" }, { code: "HN", name: "Honduras" }, { code: "HK", name: "Hong Kong SAR China" },
  { code: "HU", name: "Hungary" }, { code: "IS", name: "Iceland" }, { code: "ID", name: "Indonesia" },
  { code: "IR", name: "Iran" }, { code: "IQ", name: "Iraq" }, { code: "IE", name: "Ireland" },
  { code: "IM", name: "Isle of Man" }, { code: "IL", name: "Israel" }, { code: "IT", name: "Italy" },
  { code: "JM", name: "Jamaica" }, { code: "JP", name: "Japan" }, { code: "JE", name: "Jersey" },
  { code: "JO", name: "Jordan" }, { code: "KZ", name: "Kazakhstan" }, { code: "KE", name: "Kenya" },
  { code: "KI", name: "Kiribati" }, { code: "KW", name: "Kuwait" }, { code: "KG", name: "Kyrgyzstan" },
  { code: "LA", name: "Laos" }, { code: "LV", name: "Latvia" }, { code: "LB", name: "Lebanon" },
  { code: "LS", name: "Lesotho" }, { code: "LR", name: "Liberia" }, { code: "LY", name: "Libya" },
  { code: "LI", name: "Liechtenstein" }, { code: "LT", name: "Lithuania" }, { code: "LU", name: "Luxembourg" },
  { code: "MO", name: "Macao SAR China" }, { code: "MG", name: "Madagascar" }, { code: "MW", name: "Malawi" },
  { code: "MY", name: "Malaysia" }, { code: "MV", name: "Maldives" }, { code: "ML", name: "Mali" },
  { code: "MT", name: "Malta" }, { code: "MH", name: "Marshall Islands" }, { code: "MQ", name: "Martinique" },
  { code: "MR", name: "Mauritania" }, { code: "MU", name: "Mauritius" }, { code: "YT", name: "Mayotte" },
  { code: "MX", name: "Mexico" }, { code: "FM", name: "Micronesia" }, { code: "MD", name: "Moldova" },
  { code: "MC", name: "Monaco" }, { code: "MN", name: "Mongolia" }, { code: "ME", name: "Montenegro" },
  { code: "MS", name: "Montserrat" }, { code: "MA", name: "Morocco" }, { code: "MZ", name: "Mozambique" },
  { code: "MM", name: "Myanmar (Burma)" }, { code: "NA", name: "Namibia" }, { code: "NR", name: "Nauru" },
  { code: "NP", name: "Nepal" }, { code: "NL", name: "Netherlands" }, { code: "NC", name: "New Caledonia" },
  { code: "NZ", name: "New Zealand" }, { code: "NI", name: "Nicaragua" }, { code: "NE", name: "Niger" },
  { code: "NG", name: "Nigeria" }, { code: "NU", name: "Niue" }, { code: "NF", name: "Norfolk Island" },
  { code: "KP", name: "North Korea" }, { code: "MK", name: "North Macedonia" }, { code: "MP", name: "Northern Mariana Islands" },
  { code: "NO", name: "Norway" }, { code: "OM", name: "Oman" }, { code: "PK", name: "Pakistan" },
  { code: "PW", name: "Palau" }, { code: "PS", name: "Palestinian Territories" }, { code: "PA", name: "Panama" },
  { code: "PG", name: "Papua New Guinea" }, { code: "PY", name: "Paraguay" }, { code: "PE", name: "Peru" },
  { code: "PH", name: "Philippines" }, { code: "PN", name: "Pitcairn Islands" }, { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" }, { code: "PR", name: "Puerto Rico" }, { code: "QA", name: "Qatar" },
  { code: "RE", name: "Réunion" }, { code: "RO", name: "Romania" }, { code: "RU", name: "Russia" },
  { code: "RW", name: "Rwanda" }, { code: "WS", name: "Samoa" }, { code: "SM", name: "San Marino" },
  { code: "ST", name: "São Tomé & Príncipe" }, { code: "CQ", name: "Sark" }, { code: "SA", name: "Saudi Arabia" },
  { code: "SN", name: "Senegal" }, { code: "RS", name: "Serbia" }, { code: "SC", name: "Seychelles" },
  { code: "SL", name: "Sierra Leone" }, { code: "SG", name: "Singapore" }, { code: "SX", name: "Sint Maarten" },
  { code: "SK", name: "Slovakia" }, { code: "SI", name: "Slovenia" }, { code: "SB", name: "Solomon Islands" },
  { code: "SO", name: "Somalia" }, { code: "ZA", name: "South Africa" }, { code: "GS", name: "South Georgia & South Sandwich Islands" },
  { code: "KR", name: "South Korea" }, { code: "SS", name: "South Sudan" }, { code: "ES", name: "Spain" },
  { code: "LK", name: "Sri Lanka" }, { code: "BL", name: "St. Barthélemy" }, { code: "SH", name: "St. Helena" },
  { code: "KN", name: "St. Kitts & Nevis" }, { code: "LC", name: "St. Lucia" }, { code: "MF", name: "St. Martin" },
  { code: "PM", name: "St. Pierre & Miquelon" }, { code: "VC", name: "St. Vincent & Grenadines" }, { code: "SD", name: "Sudan" },
  { code: "SR", name: "Suriname" }, { code: "SJ", name: "Svalbard & Jan Mayen" }, { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" }, { code: "SY", name: "Syria" }, { code: "TW", name: "Taiwan" },
  { code: "TJ", name: "Tajikistan" }, { code: "TZ", name: "Tanzania" }, { code: "TH", name: "Thailand" },
  { code: "TL", name: "Timor-Leste" }, { code: "TG", name: "Togo" }, { code: "TK", name: "Tokelau" },
  { code: "TO", name: "Tonga" }, { code: "TT", name: "Trinidad & Tobago" }, { code: "TN", name: "Tunisia" },
  { code: "TR", name: "Türkiye" }, { code: "TM", name: "Turkmenistan" }, { code: "TC", name: "Turks & Caicos Islands" },
  { code: "TV", name: "Tuvalu" }, { code: "VI", name: "U.S. Virgin Islands" }, { code: "UG", name: "Uganda" },
  { code: "UA", name: "Ukraine" }, { code: "AE", name: "United Arab Emirates" }, { code: "UY", name: "Uruguay" },
  { code: "UZ", name: "Uzbekistan" }, { code: "VU", name: "Vanuatu" }, { code: "VA", name: "Vatican City" },
  { code: "VE", name: "Venezuela" }, { code: "VN", name: "Vietnam" }, { code: "WF", name: "Wallis & Futuna" },
  { code: "EH", name: "Western Sahara" }, { code: "YE", name: "Yemen" }, { code: "ZM", name: "Zambia" },
  { code: "ZW", name: "Zimbabwe" },
];

export function getCountry(code: string | null | undefined): Country | undefined {
  if (!code) return undefined;
  return COUNTRIES.find((c) => c.code === code);
}

/** Subdivisions for a country by code, or [] if it uses free-form regions. */
export function getSubdivisions(code: string | null | undefined): Subdivision[] {
  return getCountry(code)?.subdivisions ?? [];
}

export function subdivisionLabel(code: string | null | undefined): string {
  return getCountry(code)?.subdivisionLabel ?? "State / Province / Region";
}
