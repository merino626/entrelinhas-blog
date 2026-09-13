import { IsJWT, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LIMITS } from '../../common/limits';

export class ResetPasswordDto {
  /** access_token do link de recuperação (tipo "recovery"), do #fragment do e-mail. */
  @IsJWT({ message: 'Link de recuperação inválido ou expirado.' })
  token: string;

  @IsString()
  @MinLength(LIMITS.password.min, {
    message: `A senha precisa ter pelo menos ${LIMITS.password.min} caracteres.`,
  })
  @MaxLength(LIMITS.password.max)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'A senha precisa conter letra minúscula, maiúscula e número.',
  })
  password: string;
}
