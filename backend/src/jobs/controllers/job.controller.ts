
import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    HttpException,
    HttpStatus,
    UseGuards,
    Logger,
} from '@nestjs/common';
import { JobService } from '../services/job.service';
import { CreateJobDto } from '../dto/create-job.dto';
import { RateLimitGuard } from '../../common/guards/rate-limit.guard';

@Controller('jobs')
export class JobController {
    private readonly logger = new Logger(JobController.name);

    constructor(private jobService: JobService) { }

    @Post()
    @UseGuards(RateLimitGuard)
    async createJob(@Body() createJobDto: CreateJobDto) {
        try {
            this.logger.log(`Creating new job with input: ${createJobDto.input.substring(0, 50)}...`);
            return await this.jobService.createJob(createJobDto);
        } catch (error) {
            this.logger.error(`Failed to create job: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to create job: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get()
    async getAllJobs() {
        try {
            this.logger.log('Retrieving all jobs');
            return await this.jobService.getAllJobs();
        } catch (error) {
            this.logger.error(`Failed to retrieve jobs: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to retrieve jobs: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get(':id')
    async getJobById(@Param('id') id: string) {
        try {
            this.logger.log(`Retrieving job with ID: ${id}`);
            const job = await this.jobService.getJobById(id);

            if (!job) {
                this.logger.warn(`Job with ID ${id} not found`);
                throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
            }

            return job;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error(`Failed to retrieve job ${id}: ${error.message}`, error.stack);
            throw new HttpException(
                `Failed to retrieve job: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}