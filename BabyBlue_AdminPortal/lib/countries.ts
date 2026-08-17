// Country/nationality list for the identity forms. Common Southern-African
// nationalities are surfaced first (the primary patient base), then the rest
// alphabetically. Kept as plain data so the value stored in patients.nationality
// stays a stable country name string.

export const COUNTRIES: string[] = [
  "South Africa",
  "Zimbabwe",
  "Mozambique",
  "Lesotho",
  "Eswatini",
  "Botswana",
  "Namibia",
  "Malawi",
  "Zambia",
  "Democratic Republic of the Congo",
  "Nigeria",
  "Ghana",
  "Kenya",
  "Tanzania",
  "Angola",
  // ── rest, alphabetical ──
  "Afghanistan", "Albania", "Algeria", "Argentina", "Australia", "Austria",
  "Bangladesh", "Belgium", "Brazil", "Bulgaria", "Cameroon", "Canada", "Chile",
  "China", "Colombia", "Côte d'Ivoire", "Croatia", "Cuba", "Denmark", "Egypt",
  "Ethiopia", "Finland", "France", "Germany", "Greece", "Hungary", "India",
  "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Japan", "Jordan",
  "Kuwait", "Lebanon", "Libya", "Madagascar", "Malaysia", "Mali", "Mauritius",
  "Mexico", "Morocco", "Nepal", "Netherlands", "New Zealand", "Norway",
  "Pakistan", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saudi Arabia", "Senegal", "Serbia", "Sierra Leone",
  "Singapore", "Somalia", "South Korea", "South Sudan", "Spain", "Sri Lanka",
  "Sudan", "Sweden", "Switzerland", "Syria", "Thailand", "Tunisia", "Turkey",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Vietnam", "Yemen",
];

/** Case-insensitive membership check — used to reject free-text nationality. */
export function isKnownCountry(value: string): boolean {
  const v = value.trim().toLowerCase();
  return COUNTRIES.some((c) => c.toLowerCase() === v);
}
