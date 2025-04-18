import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateJobDto {
    @IsString()
    @IsNotEmpty()
    // @MaxLength(1000)
    input: string;
}