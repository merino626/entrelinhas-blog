import { IsEmail, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { LIMITS } from '../../common/limits';

export class RegisterDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(LIMITS.password.min, {
    message: `A senha precisa ter pelo menos ${LIMITS.password.min} caracteres.`,
  })
  @MaxLength(LIMITS.password.max)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'A senha precisa conter letra minúscula, maiúscula e número.',
  })
  password: string;

  @IsString()
  @Length(LIMITS.username.min, LIMITS.username.max)
  @Matches(LIMITS.username.pattern, {
    message: 'Username deve conter apenas letras minúsculas, números e _.',
  })
  username: string;

  @IsString()
  @Length(LIMITS.displayName.min, LIMITS.displayName.max)
  displayName: string;
}
