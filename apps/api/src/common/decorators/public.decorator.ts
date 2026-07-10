import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca a rota como pública. Se um Bearer token válido vier junto,
 * o usuário é anexado ao request (auth opcional); se não vier, segue anônimo.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
