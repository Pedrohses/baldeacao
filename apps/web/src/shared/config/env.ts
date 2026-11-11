import { z } from 'zod';

export const envSchema = z.object({
  apiUrl: z.url(),
  wsUrl: z.url(),
  mapStyleUrl: z.url(),
});

export type Env = z.infer<typeof envSchema>;

// Cada NEXT_PUBLIC_* precisa aparecer literal para o Next embutir o valor no bundle do cliente.
export const env: Env = envSchema.parse({
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  wsUrl: process.env.NEXT_PUBLIC_WS_URL,
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL,
});
