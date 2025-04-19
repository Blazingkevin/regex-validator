import React, { createContext, useReducer, useContext, useEffect, useCallback, ReactNode } from 'react';
import { jobApi } from '../api/jobApi';
import socketManager from '../utils/socketManager';
import { Job, JobStatus, JobUpdate, Toast, ConnectionState } from '../types/job';

interface JobState {
    jobs: Job[];
    loading: boolean;
    error: string | null;
    socketConnected: boolean;
    connectionState: ConnectionState;
    toasts: Toast[];
}

const initialState: JobState = {
    jobs: [],
    loading: false,
    error: null,
    socketConnected: false,
    connectionState: 'disconnected',
    toasts: [],
};

interface JobContextValue extends JobState {
    fetchJobs: () => Promise<void>;
    createJob: (input: string) => Promise<Job>;
    addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
    removeToast: (id: number) => void;
}

enum ActionType {
    FETCH_JOBS_REQUEST = 'FETCH_JOBS_REQUEST',
    FETCH_JOBS_SUCCESS = 'FETCH_JOBS_SUCCESS',
    FETCH_JOBS_FAILURE = 'FETCH_JOBS_FAILURE',
    CREATE_JOB_REQUEST = 'CREATE_JOB_REQUEST',
    CREATE_JOB_SUCCESS = 'CREATE_JOB_SUCCESS',
    CREATE_JOB_FAILURE = 'CREATE_JOB_FAILURE',
    UPDATE_JOB_STATUS = 'UPDATE_JOB_STATUS',
    SET_CONNECTION_STATE = 'SET_CONNECTION_STATE',
    ADD_TOAST = 'ADD_TOAST',
    REMOVE_TOAST = 'REMOVE_TOAST',
}

type JobAction =
    | { type: ActionType.FETCH_JOBS_REQUEST }
    | { type: ActionType.FETCH_JOBS_SUCCESS; payload: Job[] }
    | { type: ActionType.FETCH_JOBS_FAILURE; payload: string }
    | { type: ActionType.CREATE_JOB_REQUEST }
    | { type: ActionType.CREATE_JOB_SUCCESS; payload: Job }
    | { type: ActionType.CREATE_JOB_FAILURE; payload: string }
    | { type: ActionType.UPDATE_JOB_STATUS; payload: JobUpdate }
    | { type: ActionType.SET_CONNECTION_STATE; payload: ConnectionState }
    | { type: ActionType.ADD_TOAST; payload: Toast }
    | { type: ActionType.REMOVE_TOAST; payload: number };

function jobReducer(state: JobState, action: JobAction): JobState {
    // console.log('Reducer action:', action, 'State:', state);
    switch (action.type) {
        case ActionType.FETCH_JOBS_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
            };

        case ActionType.FETCH_JOBS_SUCCESS:
            return {
                ...state,
                jobs: action.payload,
                loading: false,
            };

        case ActionType.FETCH_JOBS_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload,
            };

        case ActionType.CREATE_JOB_REQUEST:
            return {
                ...state,
                loading: true,
                error: null,
            };

        case ActionType.CREATE_JOB_SUCCESS:
            return {
                ...state,
                jobs: [action.payload, ...state.jobs],
                loading: false,
            };

        case ActionType.CREATE_JOB_FAILURE:
            return {
                ...state,
                loading: false,
                error: action.payload,
            };

        case ActionType.UPDATE_JOB_STATUS:
            return {
                ...state,
                jobs: state.jobs.map(job =>
                    job.id === action.payload.jobId
                        ? { ...job, status: action.payload.status, message: action.payload.message }
                        : job
                ),
            };

        case ActionType.SET_CONNECTION_STATE:
            return {
                ...state,
                connectionState: action.payload,
                socketConnected: action.payload === 'connected',
            };

        case ActionType.ADD_TOAST:
            return {
                ...state,
                toasts: [...state.toasts, action.payload],
            };

        case ActionType.REMOVE_TOAST:
            return {
                ...state,
                toasts: state.toasts.filter(toast => toast.id !== action.payload),
            };

        default:
            return state;
    }
}

export const JobContext = createContext<JobContextValue | undefined>(undefined) as React.Context<JobContextValue>;


interface JobProviderProps {
    children: ReactNode;
}

export function JobProvider({ children }: JobProviderProps): JSX.Element {
    const [state, dispatch] = useReducer(jobReducer, initialState);

    // Add toast notification
    const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
        const id = Date.now();
        dispatch({
            type: ActionType.ADD_TOAST,
            payload: { id, message, type },
        });

        // Auto-remove after 5 seconds
        setTimeout(() => {
            dispatch({
                type: ActionType.REMOVE_TOAST,
                payload: id,
            });
        }, 5000);
    }, []);

    // Fetch all jobs
    const fetchJobs = useCallback(async () => {
        dispatch({ type: ActionType.FETCH_JOBS_REQUEST });
        console.log('Fetching jobs...');
        try {
            const jobs = await jobApi.getAllJobs();
            dispatch({
                type: ActionType.FETCH_JOBS_SUCCESS,
                payload: jobs,
            });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            dispatch({
                type: ActionType.FETCH_JOBS_FAILURE,
                payload: errorMessage,
            });
            addToast(`Failed to fetch jobs: ${errorMessage}`, 'error');
        }
    }, [addToast]);

    // Create a new job
    const createJob = useCallback(async (input: string): Promise<Job> => {
        dispatch({ type: ActionType.CREATE_JOB_REQUEST });

        try {
            const newJob = await jobApi.createJob(input);
            dispatch({
                type: ActionType.CREATE_JOB_SUCCESS,
                payload: newJob,
            });
            addToast('Job created successfully', 'success');
            return newJob;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
            dispatch({
                type: ActionType.CREATE_JOB_FAILURE,
                payload: errorMessage,
            });
            addToast(`Failed to create job: ${errorMessage}`, 'error');
            throw error;
        }
    }, [addToast]);

    // Remove a toast
    const removeToast = useCallback((id: number) => {
        dispatch({
            type: ActionType.REMOVE_TOAST,
            payload: id,
        });
    }, []);

    // hadnnle web socket conection
    useEffect(() => {
        // console.log('Initializing WebSocket connection...');
        const SOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
        console.log('WebSocket URL:', SOCKET_URL);
        // Connect to WebSocket server
        socketManager.connect(SOCKET_URL);

        // Listen for connection state changes
        const unsubscribe = socketManager.onConnectionStateChange((connectionState) => {
            dispatch({
                type: ActionType.SET_CONNECTION_STATE,
                payload: connectionState,
            });

            // Show toast notifications for connection changes
            if (connectionState === 'connected') {
                addToast('Connected to server', 'success');
            } else if (connectionState === 'disconnected') {
                addToast('Disconnected from server', 'error');
            }
        });

        // Setup WebSocket event listeners
        const jobUpdateListener = (update: JobUpdate) => {
            console.log('Job update received:', update);
            dispatch({
                type: ActionType.UPDATE_JOB_STATUS,
                payload: update,
            });

            // Show toast for completed jobs
            if (update.status === JobStatus.VALID || update.status === JobStatus.INVALID) {
                addToast(`Job #${update.jobId.substring(0, 8)} is ${update.status.toLowerCase()}`, 'info');
            } else if (update.status === JobStatus.FAILED) {
                addToast(`Job #${update.jobId.substring(0, 8)} failed: ${update.message || 'Unknown error'}`, 'error');
            }

            console.log("There is a chang")
        };

        const removeJobUpdateListener = socketManager.on('jobUpdate', jobUpdateListener);

        socketManager.socket?.onAny((event, ...args) => {
            console.log('Any event received:', event, args);
          });

        // Fetch jobs on component mount
        fetchJobs();

        // Cleanup function
        return () => {
            unsubscribe();
            removeJobUpdateListener();
            socketManager.disconnect();
        };
    }, [addToast, fetchJobs]);

    // Context value
    const value: JobContextValue = {
        ...state,
        fetchJobs,
        createJob,
        addToast,
        removeToast,
    };
    
    return <JobContext.Provider value={value}>{children}</JobContext.Provider>;

}

// Custom hook to use the job context
export function useJobContext(): JobContextValue {
    const context = useContext(JobContext);
    if (context === undefined) {
        throw new Error('useJobContext must be used within a JobProvider');
    }
    return context;
}