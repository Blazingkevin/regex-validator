import React, { useEffect, useMemo } from 'react';
import { useJobContext } from '../context/JobContext';
import { getStatusClassName, formatTimestamp, truncateText } from '../utils/statusUtils';
import { Job } from '../types/job';

interface JobRowProps {
  job: Job;
}

// Memoize job rows to prevent unnecessary re-renders
const JobRow: React.FC<JobRowProps> = React.memo(({ job }) => {
  const statusClassName = getStatusClassName(job.status);
  
  return (
    <tr>
      <td title={job.id}>{truncateText(job.id, 8)}</td>
      <td title={job.input}>{truncateText(job.input, 30)}</td>
      <td title={job.pattern}>{truncateText(job.pattern, 20)}</td>
      <td>
        <span className={`status ${statusClassName}`}>
          {job.status}
        </span>
        {job.message && (
          <div style={{ fontSize: '12px', marginTop: '4px' }}>
            {truncateText(job.message, 30)}
          </div>
        )}
      </td>
      <td>{formatTimestamp(job.createdAt)}</td>
      <td>{formatTimestamp(job.updatedAt)}</td>
    </tr>
  );
});

const JobList: React.FC = () => {
  const { jobs, loading, error, fetchJobs } = useJobContext();
  
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);
  
  // Sort jobs by created date (newest first)
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [jobs]);
  
  if (loading && jobs.length === 0) {
    return <div className="card">Loading jobs...</div>;
  }
  
  if (error && jobs.length === 0) {
    return (
      <div className="card">
        <p style={{ color: 'red' }}>Error loading jobs: {error}</p>
        <button onClick={fetchJobs}>Retry</button>
      </div>
    );
  }
  
  if (jobs.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <h3>No validation jobs yet</h3>
          <p>Submit a string above to create your first validation job.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <h2>Validation Jobs</h2>
      
      <div style={{ overflowX: 'auto' }}>
        <table className="job-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Input</th>
              <th>Regex Pattern</th>
              <th>Status</th>
              <th>Created</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => (
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default JobList;