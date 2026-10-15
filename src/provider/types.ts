import type { RotateContext } from "../shared/types";

export type Provider = {
  id: string;
  weight: number;
  keyless?: boolean | undefined;
  keylessEnabled?: ((ctx: RotateContext) => boolean) | undefined;
};
