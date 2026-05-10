/**
 * Country name to flag emoji mapping.
 * Used in the statistics display to show flag icons next to country names.
 */
export const countryFlags: Record<string, string> = {
  "United States": "🇺🇸", "Germany": "🇩🇪", "Russia": "🇷🇺", "Netherlands": "🇳🇱", "France": "🇫🇷",
  "United Kingdom": "🇬🇧", "Canada": "🇨🇦", "Singapore": "🇸🇬", "Finland": "🇫🇮", "Sweden": "🇸🇪",
  "Switzerland": "🇨🇭", "Poland": "🇵🇱", "Ukraine": "🇺🇦", "Japan": "🇯🇵", "Australia": "🇦🇺",
  "Austria": "🇦🇹", "Belgium": "🇧🇪", "Brazil": "🇧🇷", "Bulgaria": "🇧🇬", "Chile": "🇨🇱",
  "Colombia": "🇨🇴", "Croatia": "🇭🇷", "Cyprus": "🇨🇾", "Czechia": "🇨🇿", "Denmark": "🇩🇰",
  "Egypt": "🇪🇬", "Estonia": "🇪🇪", "Greece": "🇬🇷", "Hong Kong": "🇭🇰", "Hungary": "🇭🇺",
  "Iceland": "🇮🇸", "India": "🇮🇳", "Indonesia": "🇮🇩", "Ireland": "🇮🇪", "Israel": "🇮🇱",
  "Italy": "🇮🇹", "Latvia": "🇱🇻", "Lithuania": "🇱🇹", "Luxembourg": "🇱🇺", "Malaysia": "🇲🇾",
  "Mexico": "🇲🇽", "Moldova": "🇲🇩", "New Zealand": "🇳🇿", "Norway": "🇳🇴", "Philippines": "🇵🇭",
  "Portugal": "🇵🇹", "Romania": "🇷🇴", "Serbia": "🇷🇸", "Slovakia": "🇸🇰", "Slovenia": "🇸🇮",
  "South Africa": "🇿🇦", "South Korea": "🇰🇷", "Spain": "🇪🇸", "Taiwan": "🇹🇼", "Thailand": "🇹🇭",
  "Türkiye": "🇹🇷", "United Arab Emirates": "🇦🇪", "Vietnam": "🇻🇳", "Argentina": "🇦🇷",
  "Belarus": "🇧🇾", "Bosnia & Herzegovina": "🇧🇦", "Cambodia": "🇰🇭", "China": "🇨🇳",
  "Costa Rica": "🇨🇷", "Cuba": "🇨🇺", "Dominican Republic": "🇩🇴", "Ecuador": "🇪🇨",
  "El Salvador": "🇸🇻", "Ethiopia": "🇪🇹", "Georgia": "🇬🇪", "Ghana": "🇬🇭", "Guatemala": "🇬🇹",
  "Honduras": "🇭🇳", "Iran": "🇮🇷", "Iraq": "🇮🇶", "Kazakhstan": "🇰🇿", "Kenya": "🇰🇪",
  "Kuwait": "🇰🇼", "Laos": "🇱🇦", "Lebanon": "🇱🇧", "Libya": "🇱🇾", "Macau": "🇲🇴",
  "Malta": "🇲🇹", "Mongolia": "🇲🇳", "Montenegro": "🇲🇪", "Morocco": "🇲🇦", "Myanmar": "🇲🇲",
  "Nepal": "🇳🇵", "Nicaragua": "🇳🇮", "Nigeria": "🇳🇬", "North Macedonia": "🇲🇰", "Oman": "🇴🇲",
  "Pakistan": "🇵🇰", "Panama": "🇵🇦", "Paraguay": "🇵🇾", "Peru": "🇵🇪", "Qatar": "🇶🇦",
  "Saudi Arabia": "🇸🇦", "Senegal": "🇸🇳", "Sri Lanka": "🇱🇰", "Syria": "🇸🇾", "Tanzania": "🇹🇿",
  "Tunisia": "🇹🇳", "Uganda": "🇺🇬", "Uruguay": "🇺🇾", "Uzbekistan": "🇺🇿", "Venezuela": "🇻🇪",
  "Yemen": "🇾🇪", "Zambia": "🇿🇲", "Zimbabwe": "🇿🇼", "Algeria": "🇩🇿", "Angola": "🇦🇴",
  "Azerbaijan": "🇦🇿", "Bahrain": "🇧🇭", "Bangladesh": "🇧🇩", "Bolivia": "🇧🇴", "Botswana": "🇧🇼",
  "Brunei": "🇧🇳", "Cameroon": "🇨🇲", "Congo (DRC)": "🇨🇩", "Congo (Republic)": "🇨🇬", "Ivory Coast": "🇨🇮",
  "Jordan": "🇯🇴", "Kyrgyzstan": "🇰🇬", "Madagascar": "🇲🇬", "Malawi": "🇲🇼", "Mali": "🇲🇱",
  "Mauritius": "🇲🇺", "Mozambique": "🇲🇿", "Namibia": "🇳🇦", "Niger": "🇳🇪",
  "North Korea": "🇰🇵", "Palestine": "🇵🇸", "Rwanda": "🇷🇼", "Somalia": "🇸🇴", "Sudan": "🇸🇩",
  "Tajikistan": "🇹🇯", "Togo": "🇹🇬", "Turkmenistan": "🇹🇲", "United States Minor Outlying Islands": "🇺🇲",
  "Western Sahara": "🇪🇭", "Afghanistan": "🇦🇫", "Albania": "🇦🇱", "Andorra": "🇦🇩", "Bahamas": "🇧🇸",
  "Barbados": "🇧🇧", "Belize": "🇧🇿", "Benin": "🇧🇯", "Bhutan": "🇧🇹", "Burkina Faso": "🇧🇫",
  "Burundi": "🇧🇮", "Cabo Verde": "🇨🇻", "Central African Republic": "🇨🇫", "Chad": "🇹🇩", "Comoros": "🇰🇲",
  "Djibouti": "🇩🇯", "Equatorial Guinea": "🇬🇶", "Eritrea": "🇪🇷", "Fiji": "🇫🇯", "Gabon": "🇬🇦",
  "Gambia": "🇬🇲", "Guinea": "🇬🇳", "Guyana": "🇬🇾", "Haiti": "🇭🇹", "Liberia": "🇱🇷", "Unknown": "❓",
};

/**
 * Returns the flag emoji for a given country name.
 * Falls back to a white flag emoji if the country is not in the map.
 * @param countryName - The English name of the country
 */
export function getFlagEmoji(countryName: string): string {
  return countryFlags[countryName] || "🏳️";
}
