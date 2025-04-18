import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobStatus {
    PENDING = 'PENDING',
    VALIDATING = 'VALIDATING',
    VALID = 'VALID',
    INVALID = 'INVALID',
    FAILED = 'FAILED',
}

@Schema({ timestamps: true })
export class Job {
    @Prop({ required: true, unique: true, index: true })
    id: string;

    @Prop({ required: true })
    input: string;

    @Prop({ required: true })
    pattern: string;

    @Prop({
        required: true,
        enum: Object.values(JobStatus),
        default: JobStatus.PENDING,
    })
    status: JobStatus;

    @Prop()
    message?: string;

    @Prop({ default: 0 })
    attempts: number;

    @Prop({ default: 0 })
    version: number;

    @Prop()
    createdAt: Date;

    @Prop()
    updatedAt: Date;
}

export const JobSchema = SchemaFactory.createForClass(Job);