import React, { useState } from 'react';
import styled from 'styled-components';

const FloatingSocials = () => {
  // Added state to track mobile taps
  const [isOpen, setIsOpen] = useState(false);

  return (
    <StyledWrapper>
      {/* Added the is-open class toggle and onClick for mobile */}
      <div 
        className={`button-box ${isOpen ? 'is-open' : ''}`} 
        onClick={() => setIsOpen(!isOpen)}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="touch left" />
        <div className="touch middle" />
        <div className="touch right" />
        
        {/* Button 4: Instagram (Left) */}
        <a href="https://instagram.com/rovin.dsz" target="_blank" rel="noopener noreferrer" className="button">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.16c3.2 0 3.58.01 4.85.07c3.25.15 4.77 1.69 4.92 4.92c.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92c-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92c-.06-1.27-.07-1.64-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92c1.27-.06 1.64-.07 4.85-.07m0-2.16c-3.26 0-3.67.01-4.95.07c-4.36.2-6.78 2.62-6.98 6.98C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98c1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.36-.2 6.78-2.62 6.98-6.98c.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16A6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 12 8a4 4 0 0 1 0 8zm7.85-11.41a1.44 1.44 0 1 1-2.88 0a1.44 1.44 0 0 1 2.88 0z" />
          </svg>
        </a>

        {/* Button 5: Telegram (Right) */}
        <a href="https://t.me/RovinDsouza" target="_blank" rel="noopener noreferrer" className="button">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.93 3.12l-19.7 7.6c-1.5.58-1.48 1.44-.27 1.81l5.05 1.58l11.68-7.36c.55-.33 1.05-.15.65.2l-9.46 8.53l-.33 4.9c.48 0 .69-.22.96-.48l2.3-2.24l4.78 3.53c.88.49 1.52.24 1.74-.8l3.16-14.88c.32-1.3-.48-1.89-1.56-1.39z" />
          </svg>
        </a>

        {/* Button 6: Ko-fi (Middle) */}
        <a href="https://ko-fi.com/rovindsouza" target="_blank" rel="noopener noreferrer" className="button">
          <svg className="icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.061-4.074-.214-.299-.04-.816.18-1.014a2.502 2.502 0 0 1 1.731-.527c1.03.005 1.773.708 2.254 1.264.483-.556 1.223-1.26 2.254-1.264a2.51 2.51 0 0 1 1.731.527c.22.198.394.715.18 1.014zm4.853-1.248c-.024.161-.093.447-.282.723-.19.278-.456.495-.733.649-.275.154-.564.24-.813.29-.251.05-.484.077-.665.092v-5.833h1.611c.182 0 .385.022.607.064.22.043.456.113.693.22.238.106.469.248.667.443.199.194.357.438.442.743.085.304.095.66.012 1.054a2.53 2.53 0 0 1-.539 1.555z" />
          </svg>
        </a>
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  /* Position it fixed at the bottom left like you wanted */
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999999;
  
  /* Fixes the ugly blue box flash on mobile */
  -webkit-tap-highlight-color: transparent;

  .button-box {
    position: relative;
    width: 12rem;
    height: 5rem;
    display: flex;
  }
  .button-box .button {
    width: 3.2rem;
    height: 3.2rem;
    position: absolute;
    left: 50%;
    top: 50%;
    cursor: pointer;
    border: 3px solid #311703;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    transition: 0.3s;
    opacity: 0.85;
    box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.4);
    text-decoration: none; /* Removes underline from links */
    color: white;
  }
  .button-box .button .icon {
    width: 24px;
    height: 24px;
    opacity: 0.7;
    transition: 0.25s;
  }

  /* Instagram Colors */
  .button-box .button:nth-child(4) {
    transform: translate(-50%, -50%) rotate(90deg);
    z-index: 30;
    background: #E1306C;
  }
  /* Telegram Colors */
  .button-box .button:nth-child(5) {
    transform: translate(-50%, -50%) rotate(-115deg);
    z-index: 40;
    background: #0088cc;
  }
  /* Ko-fi Colors */
  .button-box .button:nth-child(6) {
    transform: translate(-50%, -50%) rotate(-45deg);
    z-index: 50;
    background: #FF5E5B;
  }
  .button-box .button:nth-child(6) .icon {
    animation: active 2.2s linear infinite;
  }
  .button-box .touch {
    position: relative;
    z-index: 60;
    height: 100%;
    flex: 1;
    cursor: pointer;
  }

  /* Hover & Tap Logic for Left */
  .button-box .touch.left:hover ~ .button:nth-child(4) {
    opacity: 1;
    transform: translate(-170%, -50%) rotate(-90deg) scale(1.05);
  }
  .button-box .touch.left:hover ~ .button:nth-child(4) .icon {
    width: 25px;
    opacity: 0.9;
  }
  .button-box .touch.left:active ~ .button:nth-child(4) {
    transform: translate(-170%, -50%) rotate(-90deg) scale(0.9);
  }

  /* Hover & Tap Logic for Right */
  .button-box .touch.right:hover ~ .button:nth-child(5) {
    opacity: 1;
    transform: translate(70%, -50%) rotate(90deg) scale(1.05);
  }
  .button-box .touch.right:hover ~ .button:nth-child(5) .icon {
    width: 25px;
    opacity: 0.9;
  }
  .button-box .touch.right:active ~ .button:nth-child(5) {
    transform: translate(70%, -50%) rotate(90deg) scale(0.9);
  }

  /* Hover & Tap Logic for Middle */
  .button-box .touch.middle:hover ~ .button:nth-child(6) {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(0deg) scale(1.05);
  }
  .button-box .touch.middle:hover ~ .button:nth-child(6) .icon {
    width: 25px;
    opacity: 0.9;
  }
  .button-box .touch.middle:active ~ .button:nth-child(6) {
    transform: translate(-50%, -50%) rotate(0deg) scale(0.9);
  }

  /* Global Expansion (Added .is-open for mobile taps) */
  .button-box:hover .button:nth-child(4),
  .button-box.is-open .button:nth-child(4) {
    transform: translate(-170%, -50%) rotate(-90deg);
  }
  .button-box:hover .button:nth-child(5),
  .button-box.is-open .button:nth-child(5) {
    transform: translate(70%, -50%) rotate(90deg);
  }
  .button-box:hover .button:nth-child(6),
  .button-box.is-open .button:nth-child(6) {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  .button-box:hover .button:nth-child(6) .icon,
  .button-box.is-open .button:nth-child(6) .icon {
    animation: active 4s linear infinite;
  }
  @keyframes active {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 900px) {
    left: 15px;
    transform: none; /* Docks it to the left on mobile */
  }
`;

export default FloatingSocials;