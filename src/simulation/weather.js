// Cuaca: diundi tiap 4 jam desa, peluang tergantung musim.
const P = {
  rendheng: [['cerah', 0.42], ['mendung', 0.26], ['hujan', 0.32]],
  ketiga: [['cerah', 0.74], ['mendung', 0.2], ['hujan', 0.06]],
};
export const WEATHER_LABEL = { cerah: 'Cerah', mendung: 'Mendung', hujan: 'Hujan' };
export const WEATHER_ICON = { cerah: '☀️', mendung: '⛅', hujan: '🌧️' };

export function rollWeather(season, r = Math.random) {
  let x = r();
  for (const [k, p] of P[season]) { if ((x -= p) <= 0) return k; }
  return 'cerah';
}
