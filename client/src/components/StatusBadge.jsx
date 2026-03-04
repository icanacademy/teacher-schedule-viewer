export default function StatusBadge({ type }) {
  const styles = {
    online: 'bg-green-100 text-green-700 border-green-300',
    offline: 'bg-blue-100 text-blue-700 border-blue-300',
    both: 'bg-purple-100 text-purple-700 border-purple-300',
    unknown: 'bg-gray-100 text-gray-500 border-gray-300',
  };

  const labels = {
    online: '온라인',
    offline: '오프라인',
    both: '둘 다',
    unknown: '?',
  };

  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded border ${styles[type] || styles.unknown}`}>
      {labels[type] || type}
    </span>
  );
}
