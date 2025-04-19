import React from 'react';
import { useJobContext } from '../context/JobContext';
import { Toast as ToastType } from '../types/job';

interface ToastProps {
  id: number;
  message: string;
  type: string;
  onClose: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  return (
    <div className={`toast toast-${type}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>{message}</div>
        <button
          onClick={() => onClose(id)}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'inherit',
            fontSize: '16px',
            padding: '0 0 0 10px',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
};

const ToastNotifications: React.FC = () => {
  const { toasts, removeToast } = useJobContext();
  
  if (toasts.length === 0) {
    return null;
  }
  
  return (
    <div className="toast-container">
      {toasts.map((toast: ToastType) => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastNotifications;