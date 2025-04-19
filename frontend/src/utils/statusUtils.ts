import { JobStatus } from '../types/job';

export const getStatusClassName = (status: JobStatus): string => {
  switch (status) {
    case JobStatus.PENDING:
      return 'status-pending';
    case JobStatus.VALIDATING:
      return 'status-validating';
    case JobStatus.VALID:
      return 'status-valid';
    case JobStatus.INVALID:
      return 'status-invalid';
    case JobStatus.FAILED:
      return 'status-failed';
    default:
      return '';
  }
};

export const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return 'N/A';
  
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

export const truncateText = (text?: string, maxLength = 30): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};