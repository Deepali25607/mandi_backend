import { IsOptional, IsString, MaxLength } from 'class-validator';

export class VoiceCommandDto {
  /** Base64-encoded audio clip recorded in the browser (webm/ogg/mp4). */
  @IsOptional()
  @IsString()
  @MaxLength(8_000_000) // ~6 MB of audio — far above any few-second command clip
  audio?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  /** Typed chat message — used instead of audio when the user types. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  text?: string;
}
