declare module 'sql.js/dist/sql-asm.js' {
  import type { SqlJsStatic } from 'sql.js';
  const init: () => Promise<SqlJsStatic>;
  export default init;
}
