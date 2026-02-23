import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './widget.css'; 
import widgetStyles from './widget.css?inline';

const scriptTag = document.querySelector('script[data-company-key]') as HTMLScriptElement;
if (!scriptTag) throw new Error("Script tag with 'data-company-key' not found.");

const apiBaseUrl = new URL(scriptTag.src).origin + '/server';
const publicApiKey = scriptTag.getAttribute('data-company-key');
if (!publicApiKey) throw new Error("'data-company-key' attribute is missing.");

const ELEMENT_ID = 'rhysley-chat-widget';
let hostElement = document.getElementById(ELEMENT_ID);
if (!hostElement) {
  hostElement = document.createElement('div');
  hostElement.id = ELEMENT_ID;
  hostElement.style.all = 'initial';
  hostElement.style.position = 'fixed';
  hostElement.style.bottom = '0';
  hostElement.style.right = '0';
  hostElement.style.zIndex = '2147483647';
  document.body.appendChild(hostElement);
}

const shadowRoot = hostElement.attachShadow({ mode: 'open' });
const appRoot = document.createElement('div');
shadowRoot.appendChild(appRoot);

// Uncomment if there was issue or remove it if below implementaion is better than that for including css.
// if (import.meta.env.DEV) {
//   const styleElem = document.createElement('style');
//   styleElem.textContent = widgetStyles;
//   shadowRoot.appendChild(styleElem);
// } else {
//   const linkElem = document.createElement('link');
//   linkElem.setAttribute('rel', 'stylesheet');
//   linkElem.setAttribute('href', new URL('./widget.css', scriptTag.src).href); 
//   shadowRoot.appendChild(linkElem);
// }

const styleElem = document.createElement('style');
styleElem.textContent = widgetStyles;
shadowRoot.appendChild(styleElem);

const root = ReactDOM.createRoot(appRoot);
root.render(
  <App 
    apiBaseUrl={apiBaseUrl} 
    publicApiKey={publicApiKey} 
    shadowRoot={shadowRoot} 
  />
);