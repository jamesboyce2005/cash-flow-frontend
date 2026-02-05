import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (token) {
      // Verify token is still valid
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(user);
    }
  }, [token]);

  const handleLogin = (authToken, userData) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <div className="App">
      {!token ? (
        <Login onLogin={handleLogin} apiUrl={API_URL} />
      ) : (
        <Dashboard user={user} token={token} onLogout={handleLogout} apiUrl={API_URL} />
      )}
    </div>
  );
}

export default App;
