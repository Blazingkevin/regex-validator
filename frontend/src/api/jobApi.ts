import axios, { AxiosInstance } from 'axios';
import { Job, CreateJobRequest } from '../types/job';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Create axios instance with common configuration
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Add request interceptor for error handling
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Response Error:', error);

    // Handle specific error cases
    if (error.response) {
      // Server responded with non-2xx status
      if (error.response.status === 429) {
        return Promise.reject(new Error('Too many requests. Please try again later.'));
      }
    } else if (error.request) {
      // Request was made but no response received
      return Promise.reject(new Error('No response from server. Please check your connection.'));
    }

    return Promise.reject(error);
  }
);

export const jobApi = {
  // Create a new job
  createJob: async (input: string): Promise<Job> => {
    try {
      const request: CreateJobRequest = { input };
      const response = await apiClient.post<Job>('/jobs', request);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all jobs
  getAllJobs: async (): Promise<Job[]> => {
    try {
      const response = await apiClient.get<Job[]>('/jobs');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get a single job by ID
  getJobById: async (id: string): Promise<Job> => {
    try {
      const response = await apiClient.get<Job>(`/jobs/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

