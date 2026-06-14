import { Type } from 'class-transformer';
import {
  IsHexColor,
  IsIn,
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

class WallpaperDto {
  @IsIn(['none', 'color', 'gradient', 'image'])
  type: 'none' | 'color' | 'gradient' | 'image';

  // Hex colour, CSS gradient string, or a base64 data URL for uploaded images.
  // Generous cap so a ~2 MB inlined image still validates (dev-only feature).
  @IsString()
  @MaxLength(4_000_000)
  value: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  opacity: number;
}

export class UpdateAppearanceDto {
  @IsHexColor()
  primaryColor: string;

  @IsHexColor()
  secondaryColor: string;

  @IsIn(['light', 'dark'])
  mode: 'light' | 'dark';

  @IsInt()
  @Min(0)
  @Max(28)
  borderRadius: number;

  @IsIn(['default', 'dark', 'primary', 'accent'])
  sidebar: 'default' | 'dark' | 'primary' | 'accent';

  @ValidateNested()
  @Type(() => WallpaperDto)
  wallpaper: WallpaperDto;
}
