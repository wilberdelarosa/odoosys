export function getCurrentFormattedDateTime() {
  const formatter = new Intl.DateTimeFormat('es-DO', {
    timeZone: 'America/Santo_Domingo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const parts = formatter.formatToParts(new Date());
  const mappedParts = parts.reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return `${mappedParts.day}-${mappedParts.month}-${mappedParts.year} ${mappedParts.hour}:${mappedParts.minute}:${mappedParts.second}`;
}