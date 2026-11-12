import { z } from "zod";

const placeName = z.array(z.object({ value: z.string().trim() })).catch([]);
const area = z.object({
  areaName: placeName,
  region: placeName,
  country: placeName,
});
const temperature = z
  .string()
  .trim()
  .regex(/^-?\d+(?:\.\d+)?$/)
  .transform(Number)
  .pipe(z.number())
  .nullable()
  .catch(null);
const condition = z.object({
  temp_C: temperature,
  weatherCode: z.string().catch(""),
});
const report = z.object({
  nearest_area: z.array(area).catch([]),
  current_condition: z.array(condition).catch([]),
});

// wttr.in uses World Weather Online condition codes, including the haze and dust series.
const codes = {
  clear: [113],
  partlyCloudy: [116],
  cloudy: [119],
  overcast: [122],
  fog: [143, 248, 260],
  haze: [125, 146, 149, 152, 155],
  dust: [128, 131, 134, 137, 140, 158, 161],
  rain: [176, 263, 266, 293, 296, 299, 302, 305, 308, 353, 356, 359],
  snow: [179, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371],
  ice: [182, 185, 281, 284, 311, 314, 317, 320, 350, 362, 365, 374, 377],
  thunder: [200, 386, 389, 392, 395],
};
export type Condition = keyof typeof codes;

export function readWeather(data: unknown) {
  const result = report.safeParse(data).data;
  const nearby = result?.nearest_area[0];
  const current = result?.current_condition[0];
  const code = Number(current?.weatherCode);
  const sky = (Object.keys(codes) as Condition[]).find((key) =>
    codes[key].includes(code),
  );
  const place = [
    ...new Set(
      [
        nearby?.areaName[0]?.value,
        nearby?.region[0]?.value,
        nearby?.country[0]?.value,
      ].filter(Boolean),
    ),
  ].join(", ");
  return { place, celsius: current?.temp_C ?? null, sky: sky ?? null };
}

export async function localWeather(signal: AbortSignal) {
  const timeout = AbortSignal.timeout(5_000);
  let data: unknown;
  try {
    const response = await fetch("https://wttr.in/?format=j1", {
      signal: AbortSignal.any([signal, timeout]),
    });
    if (response.ok) data = await response.json();
  } catch {
    signal.throwIfAborted();
  }
  return readWeather(data);
}
