/// <reference types="vite/client" />

import type { VidOptiApi } from '@/types/vidopti'

declare global {
  interface Window {
    vidopti: VidOptiApi
  }
}

export {}