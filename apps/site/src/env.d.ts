declare module "*.css";
declare const __INTLOOM_RELEASE__: { tag: string; version: string } | null;
declare module "*.module.css" {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}
declare module "*.svg" {
  const url: string;
  export default url;
}
