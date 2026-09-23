const schoolDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
});

function dateKey(timestamp: number) {
  const parts = schoolDate.formatToParts(new Date(timestamp));
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return value("year") * 10000 + value("month") * 100 + value("day");
}

// Busca a primeira ocorrência da data local, inclusive em mudanças de horário.
function dayBoundary(utcDate: number) {
  const date = new Date(utcDate);
  const key = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  let start = utcDate - 36 * 60 * 60 * 1000;
  let end = utcDate + 36 * 60 * 60 * 1000;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (dateKey(middle) < key) start = middle + 1;
    else end = middle;
  }
  return new Date(start).toISOString();
}

export function schoolDayRange(now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw new Error("Data inválida");
  const key = dateKey(now.getTime());
  const utcDate = Date.UTC(Math.floor(key / 10000), Math.floor(key / 100) % 100 - 1, key % 100);
  return { start: dayBoundary(utcDate), end: dayBoundary(utcDate + 86400000) };
}
