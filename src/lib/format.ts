/**
 * "12d 4u sinds de laatste lancering" (nl) / "12d 4h since the last launch"
 * (en) - gedeeld door HostModal en Terminal (motd). Past bij het
 * ruimtestation-thema in plaats van een kaal "uptime"-getal. De vertaalde
 * stukjes (eenheden, staartzin) komen uit i18n.ts (`hosting.uptimeUnit` /
 * `hosting.sinceLaunch`) - deze functie is puur rekenwerk.
 */
export function formatUptime(sec: number, unit: { d: string; h: string }, suffix: string): string {
  const days = Math.floor(sec / 86_400)
  const hours = Math.floor((sec % 86_400) / 3600)
  const value = days > 0 ? `${days}${unit.d} ${hours}${unit.h}` : `${hours}${unit.h}`
  return `${value} ${suffix}`
}
