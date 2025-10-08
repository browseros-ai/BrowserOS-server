/**
 * @license
 * Copyright 2025 BrowserOS
 */
type CSSInJS = string & {_tag: 'CSS-in-JS'};
declare module '*.css.js' {
  const styles: CSSInJS;
  export default styles;
}
