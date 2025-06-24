const { Queue, Worker, QueueScheduler } = require('bullmq');
const Logger = require('../utils/logger');
const Redis = require('ioredis');

class QueueService {
  constructor() {
    // Redis connection for BullMQ
    this.redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });

    // Initialize queues
    this.queues = {
      photoProcessing: new Queue('photo-processing', {
        connection: this.redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000 // Start with 2 second delay
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 100 // Keep max 100 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600 // Keep failed jobs for 7 days
          }
        }
      })
    };

    // Queue scheduler for delayed/repeated jobs
    this.scheduler = new QueueScheduler('photo-processing', {
      connection: this.redisConnection
    });

    this.workers = {};
  }

  /**
   * Add a job to the photo processing queue
   */
  async addPhotoProcessingJob(data, options = {}) {
    try {
      const job = await this.queues.photoProcessing.add(
        'process-photo',
        data,
        {
          priority: options.priority || 0,
          delay: options.delay || 0,
          ...options
        }
      );

      Logger.info('Photo processing job added to queue', {
        jobId: job.id,
        userId: data.userId,
        photoId: data.photoId
      });

      return job;
    } catch (error) {
      Logger.error('Failed to add photo processing job', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize photo processing worker
   */
  initializePhotoWorker(processFunction) {
    const worker = new Worker(
      'photo-processing',
      async (job) => {
        Logger.info('Processing photo job', {
          jobId: job.id,
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts
        });

        try {
          // Call the actual processing function
          const result = await processFunction(job.data);
          
          Logger.info('Photo job completed', {
            jobId: job.id,
            photoId: job.data.photoId
          });

          return result;
        } catch (error) {
          Logger.error('Photo job failed', {
            jobId: job.id,
            attempt: job.attemptsMade + 1,
            error: error.message
          });

          // If it's a rate limit error, add extra delay before retry
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            const delayMs = Math.min(60000, 2000 * Math.pow(2, job.attemptsMade));
            Logger.info('Rate limited, adding delay before retry', { delayMs });
            throw new Error(`RATE_LIMITED:${delayMs}:${error.message}`);
          }

          throw error;
        }
      },
      {
        connection: this.redisConnection,
        concurrency: parseInt(process.env.PHOTO_WORKER_CONCURRENCY || '2'),
        limiter: {
          max: 10,
          duration: 60000 // Max 10 jobs per minute
        }
      }
    );

    // Handle worker events
    worker.on('completed', (job) => {
      Logger.info('Worker completed job', { jobId: job.id });
    });

    worker.on('failed', (job, err) => {
      Logger.error('Worker job failed', {
        jobId: job.id,
        error: err.message,
        stack: err.stack
      });
    });

    worker.on('error', (err) => {
      Logger.error('Worker error', { error: err.message });
    });

    this.workers.photoProcessing = worker;
    return worker;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    try {
      const job = await this.queues.photoProcessing.getJob(jobId);
      if (!job) {
        return null;
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        id: job.id,
        state,
        progress,
        data: job.data,
        result: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn
      };
    } catch (error) {
      Logger.error('Failed to get job status', { error: error.message });
      throw error;
    }
  }

  /**
   * Clean up old jobs
   */
  async cleanupJobs(queueName = 'photoProcessing') {
    try {
      const queue = this.queues[queueName];
      
      // Clean completed jobs older than 24 hours
      const completed = await queue.clean(24 * 3600 * 1000, 'completed');
      
      // Clean failed jobs older than 7 days
      const failed = await queue.clean(7 * 24 * 3600 * 1000, 'failed');

      Logger.info('Queue cleanup completed', {
        queue: queueName,
        completedRemoved: completed.length,
        failedRemoved: failed.length
      });

      return { completed: completed.length, failed: failed.length };
    } catch (error) {
      Logger.error('Queue cleanup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    Logger.info('Shutting down queue service...');

    // Close workers
    for (const [name, worker] of Object.entries(this.workers)) {
      await worker.close();
      Logger.info(`Worker ${name} closed`);
    }

    // Close scheduler
    await this.scheduler.close();

    // Close queues
    for (const [name, queue] of Object.entries(this.queues)) {
      await queue.close();
      Logger.info(`Queue ${name} closed`);
    }

    // Close Redis connection
    await this.redisConnection.quit();

    Logger.info('Queue service shutdown complete');
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(queueName = 'photoProcessing') {
    try {
      const queue = this.queues[queueName];
      
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
      ]);

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
      };
    } catch (error) {
      Logger.error('Failed to get queue metrics', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new QueueService(); 