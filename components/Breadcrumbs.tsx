import Link from 'next/link';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: Breadcrumb[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" style={{ margin: '1rem 0' }}>
      <ol style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', listStyle: 'none', padding: 0 }}>
        {items.map((item, idx) => (
          <li key={idx} style={{ display: 'flex', alignItems: 'center' }}>
            {item.href ? (
              <Link href={item.href} style={{ color: '#2563eb', textDecoration: 'underline' }}>{item.label}</Link>
            ) : (
              <span style={{ color: '#374151', fontWeight: 500 }}>{item.label}</span>
            )}
            {idx < items.length - 1 && <span style={{ margin: '0 0.5rem', color: '#9ca3af' }}>/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
