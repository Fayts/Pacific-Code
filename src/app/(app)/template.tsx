// Remonté par App Router à chaque navigation : anime l'entrée de la page.
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="pc-page">{children}</div>;
}
