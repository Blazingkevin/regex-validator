import React from 'react';
import JobForm from './components/JobForm';
import JobList from './components/JobList';
import ToastNotifications from './components/ToastNotifications';
import { useJobContext } from './context/JobContext';

const App: React.FC = () => {
  const { connectionState } = useJobContext();
  
  return (
    <div className="container">
      <header>
        <h1>Kevin's Regex Validator</h1>
        <p>Submit a string to validate against the configured regex pattern</p>
      </header>
      
      <ToastNotifications />
      
      <JobForm />
      <JobList />
      
      <footer style={{ marginTop: '30px', textAlign: 'center', color: '#666', padding: '20px 0' }}>
        <p>Kevin's Regex Validator &copy; {new Date().getFullYear()}</p>
        <p>
          Current connection status: {' '}
          <span className={`connection-${connectionState}`} style={{ fontWeight: 'bold' }}>
            {connectionState}
          </span>
        </p>
      </footer>
    </div>
  );
};

export default App;