import React from 'react';
import './LeaveButton.css';

const LeaveButton = ({ onClick }) => {
  return (
    <button className="leave-lobby-btn" onClick={onClick}>
      <div className="icon">
        <svg height={24} width={24} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M0 0h24v24H0z" fill="none" />
          {/* Flipped Left-Facing Arrow */}
          <path d="M7.828 11H20v2H7.828l5.364 5.364-1.414 1.414L4 12l7.778-7.778 1.414 1.414z" fill="currentColor" />
        </svg>
      </div>
      Leave Lobby
    </button>
  );
}

export default LeaveButton;