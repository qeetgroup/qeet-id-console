type CreatedRecord = { created_at?: string | null; issued_at?: string | null };

export type DeveloperMetric = {
  total: number;
  recent: number | null;
  series: { date: string; count: number }[];
};

export function summarizeDeveloperRecords(
  records: readonly CreatedRecord[],
  now = Date.now(),
): DeveloperMetric {
  const timestamps = records.map((record) =>
    Date.parse(record.created_at ?? record.issued_at ?? ""),
  );
  if (timestamps.some((timestamp) => !Number.isFinite(timestamp))) {
    return { total: records.length, recent: null, series: [] };
  }

  const day = 86_400_000;
  const today = Math.floor(now / day) * day;
  const start = today - 6 * day;
  const series = Array.from({ length: 7 }, (_, index) => ({
    date: new Date(start + index * day).toISOString().slice(0, 10),
    count: 0,
  }));
  for (const timestamp of timestamps) {
    if (timestamp < start || timestamp > now) continue;
    series[Math.floor((timestamp - start) / day)].count += 1;
  }
  return {
    total: records.length,
    recent: series.reduce((total, point) => total + point.count, 0),
    series,
  };
}

export function isCurrentCredential(
  record: { revoked_at?: string | null; expires_at?: string | null },
  now = Date.now(),
): boolean {
  return !record.revoked_at && (!record.expires_at || Date.parse(record.expires_at) > now);
}
