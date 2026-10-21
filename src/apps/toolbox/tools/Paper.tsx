// Standard paper sizes (ISO 216 A/B series and North American sizes), in millimetres.
const SIZES: [string, number, number][] = [
  ['A0', 841, 1189],
  ['A1', 594, 841],
  ['A2', 420, 594],
  ['A3', 297, 420],
  ['A4', 210, 297],
  ['A5', 148, 210],
  ['A6', 105, 148],
  ['B4', 250, 353],
  ['B5', 176, 250],
  ['Letter', 215.9, 279.4],
  ['Legal', 215.9, 355.6],
  ['Tabloid', 279.4, 431.8],
];

const px = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export default function Paper() {
  return (
    <div className="overflow-x-auto border-3 border-ink">
      <table className="w-full border-collapse font-mono text-sm">
        <thead>
          <tr className="bg-ink text-paper">
            {['Size', 'mm', 'cm', 'inches', 'px @ 300 dpi', 'px @ 96 dpi'].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-bold whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SIZES.map(([name, w, h]) => (
            <tr key={name} className="border-t-2 border-ink">
              <th className="px-3 py-2 text-left">{name}</th>
              <td className="px-3 py-2 whitespace-nowrap">
                {w} × {h}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {(w / 10).toFixed(1)} × {(h / 10).toFixed(1)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {(w / 25.4).toFixed(2)} × {(h / 25.4).toFixed(2)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {px(w, 300)} × {px(h, 300)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {px(w, 96)} × {px(h, 96)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
