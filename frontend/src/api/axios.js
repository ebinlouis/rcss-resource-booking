import axios from 'axios';

const api = axios.create({
    // This points to your Django server
    baseURL: 'http://127.0.0.1:8000/api/',
    
    // CRITICAL: This allows secure cookies to be sent across ports!
    withCredentials: true, 
    
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
});

export default api;