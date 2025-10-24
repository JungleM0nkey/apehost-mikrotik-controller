/// <reference types="vite/client" />

// CSS Modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// CSS
declare module '*.css' {
  const css: string;
  export default css;
}
