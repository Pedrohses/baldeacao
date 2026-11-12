import { PlaceSchema, TripRequestSchema, type TripRequest } from '@baldeacao/types';
import { z } from 'zod';

// `departAt` vem de <input type="datetime-local">: "AAAA-MM-DDTHH:mm" na hora local, ou vazio.
export const tripFormSchema = z
  .object({
    origin: PlaceSchema.nullable(),
    destination: PlaceSchema.nullable(),
    departAt: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.origin) {
      ctx.addIssue({ code: 'custom', path: ['origin'], message: 'Escolha a origem na lista.' });
    }
    if (!values.destination) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination'],
        message: 'Escolha o destino na lista.',
      });
    }
    if (values.origin && values.destination && values.origin.id === values.destination.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['destination'],
        message: 'Origem e destino precisam ser diferentes.',
      });
    }
    if (values.departAt && Number.isNaN(new Date(values.departAt).getTime())) {
      ctx.addIssue({ code: 'custom', path: ['departAt'], message: 'Hora de saída inválida.' });
    }
  });

export type TripFormValues = z.infer<typeof tripFormSchema>;

export type TripFormErrors = Partial<Record<keyof TripFormValues, string>>;

export type TripFormResult =
  { success: true; request: TripRequest } | { success: false; errors: TripFormErrors };

/** Valida o formulário e monta o TripRequest do contrato; sem hora de saída, parte agora. */
export function buildTripRequest(values: TripFormValues): TripFormResult {
  const parsed = tripFormSchema.safeParse(values);
  if (!parsed.success) {
    const errors: TripFormErrors = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof TripFormValues;
      errors[field] ??= issue.message;
    }
    return { success: false, errors };
  }

  const { origin, destination, departAt } = parsed.data;
  const request = TripRequestSchema.parse({
    from: origin!.location,
    to: destination!.location,
    ...(departAt ? { departAt: new Date(departAt).toISOString() } : {}),
  });
  return { success: true, request };
}
