// Zeigt die KI-Antwort lesbar an: "## Überschrift", **fett** und einfache Tabellen, sonst reiner Text
// (es wird nie HTML von außen eingesetzt).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

const isTableLine = (l: string) => l.trim().startsWith("|");
const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isSeparator = (l: string) => cells(l).every((c) => /^:?-{2,}:?$/.test(c));

function Table({ lines }: { lines: string[] }) {
  const rows = lines.filter((l) => !isSeparator(l)).map(cells);
  const [head, ...body] = rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} className="border border-zinc-300 bg-zinc-100 p-2 align-top">{inline(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className={`border border-zinc-300 p-2 align-top ${j === 0 ? "font-medium" : ""}`}>{inline(c)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") continue;
    if (isTableLine(line)) {
      const start = i;
      while (i + 1 < lines.length && isTableLine(lines[i + 1])) i++;
      const tableLines = lines.slice(start, i + 1);
      // Erst ab Kopfzeile plus Trennzeile als Tabelle zeigen; vorher (beim Streamen) als Text.
      if (tableLines.length >= 2 && isSeparator(tableLines[1])) {
        blocks.push(<Table key={start} lines={tableLines} />);
        continue;
      }
      tableLines.forEach((l, k) => blocks.push(<p key={`${start}-${k}`}>{l}</p>));
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(<h3 key={i} className="mt-4 text-lg font-semibold">{inline(line.slice(3))}</h3>);
      continue;
    }
    const listItem = /^(\d+\.|-)\s/.test(line.trim());
    blocks.push(<p key={i} className={listItem ? "pl-4" : undefined}>{inline(line)}</p>);
  }
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}
