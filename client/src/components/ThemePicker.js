import React from 'react';
import { THEMES, THEME_IDS } from '../themes';

// Two big toggle buttons to choose the visual theme
function ThemePicker({ value, onChange, disabled = false }) {
  return (
    <div className="theme-picker">
      <label>Theme</label>
      <div className="theme-options">
        {THEME_IDS.map(themeId => (
          <button
            key={themeId}
            type="button"
            className={`theme-option ${themeId} ${value === themeId ? 'selected' : ''}`}
            onClick={() => onChange(themeId)}
            disabled={disabled}
          >
            <span className="theme-option-icon">{THEMES[themeId].pickerIcon}</span>
            <span className="theme-option-label">{THEMES[themeId].label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default ThemePicker;
