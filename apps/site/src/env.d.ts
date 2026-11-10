declare module "*.css";
declare module "*.module.css" {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}
declare module "*.svg" {
  const url: string;
  export default url;
}
