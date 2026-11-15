/** Native accordion: works without JavaScript, keyboard and screen reader friendly. */
export function FaqList({ items }: { items: { id: string; questionEn: string; answer: string }[] }) {
  return (
    <div className="faq">
      {items.map((f) => (
        <details key={f.id}>
          <summary>{f.questionEn}</summary>
          <p>{f.answer}</p>
        </details>
      ))}
    </div>
  );
}
