// Zeigt die KI-Antwort lesbar an: "## Überschrift" und **fett**, sonst reiner Text (kein HTML von außen).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      part
    ),
  );
}

export function FormattedText({ text }: { text: string }) {
  return (
    <div className="space-y-2 leading-relaxed">
      {text.split("\n").map((line, i) => {
        if (line.trim() === "") return null;
        if (line.startsWith("## ")) return <h3 key={i} className="mt-4 text-lg font-semibold">{inline(line.slice(3))}</h3>;
        const listItem = /^(\d+\.|-)\s/.test(line.trim());
        return <p key={i} className={listItem ? "pl-4" : undefined}>{inline(line)}</p>;
      })}
    </div>
  );
}
