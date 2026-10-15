export type URLList = [string, ...string[]];

export type RotateContext = {
  getOption(name: string): unknown;
};
