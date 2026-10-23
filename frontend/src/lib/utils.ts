// Prices are stored in paise (1 INR = 100 paise)
// Display functions convert to INR

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

// Robust parser for SQLite datetime strings ("YYYY-MM-DD HH:MM:SS") or ISO-8601
export function parseServerDate(dateStr: string | Date | undefined | null): Date {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  if (typeof dateStr === 'string') {
    // If SQLite UTC format without timezone suffix (e.g. "2026-10-23 07:28:15")
    if (dateStr.includes(' ') && !dateStr.includes('T') && !dateStr.includes('Z') && !dateStr.includes('+')) {
      return new Date(dateStr.replace(' ', 'T') + 'Z');
    }
  }
  return new Date(dateStr);
}

export function formatDate(dateStr: string | Date): string {
  return parseServerDate(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatDateTime(dateStr: string | Date): string {
  return parseServerDate(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export function formatTimeOnly(dateStr: string | Date): string {
  return parseServerDate(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

export function getElapsedMinutes(dateStr: string | Date): string {
  const diffMs = Date.now() - parseServerDate(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 0) return 'Just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function getISTDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid': return 'text-green-400 bg-green-400/10';
    case 'partial': return 'text-yellow-400 bg-yellow-400/10';
    case 'pending': return 'text-red-400 bg-red-400/10';
    default: return 'text-gray-400 bg-gray-400/10';
  }
}

export function getOrderStatusColor(status: string): string {
  switch (status) {
    case 'preparing': return 'text-blue-400 bg-blue-400/10';
    case 'ready': return 'text-purple-400 bg-purple-400/10';
    case 'completed': return 'text-green-400 bg-green-400/10';
    case 'cancelled': return 'text-red-400 bg-red-400/10';
    default: return 'text-gray-400 bg-gray-400/10';
  }
}

export function downloadCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
