import { useDark } from '@/lib/use-dark';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Single-series charts: one hue, no legend (the title names the series), thin marks,
// recessive grid, hover tooltip, and a table view for screen readers and exact values.
// Per theme: electric blue series, recessive grid and axis text that pass contrast.
const PALETTE = {
  light: { series: '#2a5fe8', grid: '#dde2f2', axis: '#525b7d', cursor: '#e9edf7', tooltipBg: '#ffffff', tooltipText: '#0a0e1f' },
  dark: { series: '#7fa6ff', grid: '#232c58', axis: '#9aa3c7', cursor: '#1a2142', tooltipBg: '#121831', tooltipText: '#eef1ff' },
};
function usePalette() {
  return PALETTE[useDark() ? 'dark' : 'light'];
}

interface Point {
  label: string;
  value: number;
}

function DataTable({ title, data, unit }: { title: string; data: Point[]; unit: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">{title}</summary>
      <table className="mt-2 w-full text-left">
        <tbody>
          {data.map((d) => (
            <tr key={d.label} className="border-b border-border">
              <th scope="row" className="py-1 font-normal">
                {d.label}
              </th>
              <td className="py-1 text-right tabular-nums">
                {d.value.toLocaleString('es', { maximumFractionDigits: 1 })} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const fmt = (v: number) => v.toLocaleString('es', { maximumFractionDigits: 1 });

export function BarSeries({ data, unit, tableTitle, horizontal = false }: { data: Point[]; unit: string; tableTitle: string; horizontal?: boolean }) {
  const c = usePalette();
  const AXIS = { fontSize: 12, fill: c.axis };
  return (
    <figure className="flex flex-col gap-2">
      <div className={horizontal ? 'h-64' : 'h-48'} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -16 }} barCategoryGap={2}>
            <CartesianGrid stroke={c.grid} vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={AXIS} tickFormatter={fmt} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={AXIS} width={72} axisLine={false} tickLine={false} />
              </>
            ) : (
              <>
                <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS} tickFormatter={fmt} axisLine={false} tickLine={false} allowDecimals={false} />
              </>
            )}
            <Tooltip formatter={(v) => [`${fmt(Number(v))} ${unit}`, '']} separator="" cursor={{ fill: c.cursor }} contentStyle={{ background: c.tooltipBg, color: c.tooltipText, border: 'none', borderRadius: 12 }} />
            <Bar dataKey="value" fill={c.series} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable title={tableTitle} data={data} unit={unit} />
    </figure>
  );
}

export function LineSeries({ data, unit, tableTitle }: { data: Point[]; unit: string; tableTitle: string }) {
  const c = usePalette();
  const AXIS = { fontSize: 12, fill: c.axis };
  return (
    <figure className="flex flex-col gap-2">
      <div className="h-52" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={AXIS} tickFormatter={fmt} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => [`${fmt(Number(v))} ${unit}`, '']} separator="" contentStyle={{ background: c.tooltipBg, color: c.tooltipText, border: 'none', borderRadius: 12 }} />
            <Line type="monotone" dataKey="value" stroke={c.series} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: c.tooltipBg }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable title={tableTitle} data={data} unit={unit} />
    </figure>
  );
}
