import React from 'react';

interface LogoutButtonProps {
  onLogout: () => void;
}

const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout }) => (
  <button
    onClick={onLogout}
    className="py-2 px-4 bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white text-sm font-semibold rounded-lg transition-all duration-200 ml-4 shadow-md focus:outline-none focus:ring-2 focus:ring-red-400 flex items-center gap-1"
    aria-label="Logout"
  >
    <span role="img" aria-label="logout">🚪</span>
    Logout
  </button>
);

export default LogoutButton;
