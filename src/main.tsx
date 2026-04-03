import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Catch global errors to help debug "white screen" issues
window.onerror = (message, source, lineno, colno, error) => {
  const rootElement = document.getElementById('root');
  if (rootElement && rootElement.innerHTML === '') {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; text-align: center;">
        <h1 style="color: #e11d48;">حدث خطأ أثناء تشغيل التطبيق</h1>
        <p style="color: #4b5563;">يرجى التأكد من إعداد مفتاح API وربط Firebase بشكل صحيح.</p>
        <pre style="background: #f3f4f6; padding: 10px; border-radius: 5px; text-align: left; display: inline-block; max-width: 100%; overflow: auto;">
          ${message}
        </pre>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
