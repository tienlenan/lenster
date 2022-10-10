import type { FC } from 'react';

declare module 'react-window-scroller' {
  export type ReactWindowScroller = FC<{
    children: any;
    throttleTime: number;
    isGrid: boolean;
  }>;

  export { ReactWindowScroller };
}
