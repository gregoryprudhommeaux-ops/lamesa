import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/** Next.js 16 ships flat configs — avoid FlatCompat (circular JSON with ESLint 9). */
const eslintConfig = [...nextCoreWebVitals, ...nextTypescript];

export default eslintConfig;
