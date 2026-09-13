import { IsEmail, MaxLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(254)
  email: string;
}
