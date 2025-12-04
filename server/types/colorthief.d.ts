declare module "colorthief" {
  type RGBColor = [number, number, number];
  
  interface ColorThief {
    getColor(source: string, quality?: number): Promise<RGBColor>;
    getPalette(source: string, colorCount?: number, quality?: number): Promise<RGBColor[]>;
  }
  
  const ColorThief: ColorThief;
  export default ColorThief;
}
