import React, { useState, FormEvent } from 'react';
import { useJobContext } from '../context/JobContext';
import { ConnectionState } from '../types/job';

interface ConnectionStatusProps {
  state: ConnectionState;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ state }) => {
  let statusText: string;
  let className: string;
  
  switch (state) {
    case 'connected':
      statusText = 'Connected to server';
      className = 'connection-connected';
      break;
    case 'connecting':
      statusText = 'Connecting to server...';
      className = 'connection-connecting';
      break;
    case 'disconnected':
      statusText = 'Disconnected from server';
      className = 'connection-disconnected';
      break;
    default:
      statusText = 'Unknown connection state';
      className = 'connection-disconnected';
  }
  
  return (
    <div className={`connection-status ${className}`}>
      {statusText}
    </div>
  );
};

const JobForm: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [inputError, setInputError] = useState<string>('');
  const { createJob, loading, connectionState } = useJobContext();
  
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim()) {
      setInputError('Please enter a string to validate');
      return;
    }
    
    if (input.length > 1000) {
      setInputError('Input is too long (maximum 1000 characters)');
      return;
    }
    
    setInputError('');
    
    try {
      await createJob(input);
      setInput(''); 
    } catch (error) {
      console.error('Error creating job:', error);

      // already handled error in contesx
    }
  };
  
  const isDisabled = loading || connectionState !== 'connected';
  
  return (
    <div className="card">
      <h2>Submit String for Validation</h2>
      
      <ConnectionStatus state={connectionState} />
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="input">Enter a string to validate against the regex pattern:</label>
          <textarea
            id="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text to validate..."
            rows={4}
            disabled={isDisabled}
          />
          {inputError && <p className="error-message" style={{ color: 'red' }}>{inputError}</p>}
        </div>
        
        <button type="submit" disabled={isDisabled}>
          {loading ? 'Submitting...' : 'Validate String'}
        </button>
      </form>
    </div>
  );
};

export default JobForm;