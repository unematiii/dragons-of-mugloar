import type { Task } from '@/api/types.js';

export function getTaskEncodingLabel(encoding: Task['encoding']): string | null {
  switch (encoding) {
    case 'base64-mode-1':
      return 'Decoded from Base64';
    case 'rot13-mode-2':
      return 'Decoded from ROT13';
    case 'plain':
    case 'unsupported':
      return null;
  }
}
