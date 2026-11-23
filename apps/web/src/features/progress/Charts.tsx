import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Single-series charts: one hue, no legend (the title names the series), thin marks,
// recessive grid, hover tooltip, and a table view for screen readers and exact values.
const SERIES = '#2563eb';
const GRID = '#e5e7eb';
const AXIS = { fontSize: 12, fill: '#6b7280' };

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
  return (
    <figure className="flex flex-col gap-2">
      <div className={horizontal ? 'h-64' : 'h-48'} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 8, bottom: 0, left: horizontal ? 8 : -16 }} barCategoryGap={2}>
            <CartesianGrid stroke={GRID} vertical={horizontal} horizontal={!horizontal} />
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
            <Tooltip formatter={(v) => [`${fmt(Number(v))} ${unit}`, '']} separator="" cursor={{ fill: '#f3f4f6' }} />
            <Bar dataKey="value" fill={SERIES} radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable title={tableTitle} data={data} unit={unit} />
    </figure>
  );
}

export function LineSeries({ data, unit, tableTitle }: { data: Point[]; unit: string; tableTitle: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="h-52" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={AXIS} tickFormatter={fmt} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => [`${fmt(Number(v))} ${unit}`, '']} separator="" />
            <Line type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable title={tableTitle} data={data} unit={unit} />
    </figure>
  );
}
