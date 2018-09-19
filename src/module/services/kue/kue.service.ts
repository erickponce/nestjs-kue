import { Injectable } from '@nestjs/common';
import { TaskMetadata } from '../../utils/task.decorator';
import { FancyLoggerService } from '../fancy-logger/fancy-logger.service';
import { Controller } from "@nestjs/common/interfaces";
import * as kue from 'kue';

@Injectable()
export class KueService {
    private static readonly DEFAULT_CONCURRENCY: number = 4;
    private static readonly DEFAULT_QUEUE_NAME: string = 'default';
    private static readonly DEBUG_EVENTS: Array<string> = [
        'job enqueue',
        'job complete',
        'job failed attempt',
        'job failed',
    ];

    private queues: { [name: string]: kue.Queue } = {};
    private tasks: { [name: string]: TaskMetadata } = {};
    private debugActive: boolean = false;
    private redisConfig = {
        prefix: process.env.KUE_REDIS_PREFIX,
    };

    constructor(
        private readonly fancyLogger: FancyLoggerService
    ) {
        if (process.env.KUE_REDIS_URI) {
            this.redisConfig = {
                ...this.redisConfig, redis: process.env.KUE_REDIS_URI,
            };
        } else {
            this.redisConfig = {
                ...this.redisConfig, redis: {
                    port: process.env.KUE_REDIS_PORT,
                    host: process.env.KUE_REDIS_HOST,
                    db: process.env.KUE_REDIS_DB,
                },
            };
        }

        this.queues[KueService.DEFAULT_QUEUE_NAME] = this.createQueue(KueService.DEFAULT_QUEUE_NAME);
        if ((eval(process.env.KUE_UI_ENABLED) || false)) {
            const uiPort: number = parseInt(process.env.KUE_UI_PORT, null) || 3050;
            kue.app.listen(uiPort, '0.0.0.0',);
            this.fancyLogger.info('KueModule', `UI started on port ${uiPort}`, 'UI');
        }
    }

    registerTask(task: (job, done) => void, metadata: TaskMetadata, ctrl: Controller) {
        let queueName: string = metadata.queue || KueService.DEFAULT_QUEUE_NAME;
        let concurrency: number = metadata.concurrency || KueService.DEFAULT_CONCURRENCY;
        if (!this.queues[queueName]) {
            this.queues[queueName] = this.createQueue(queueName);
        }
        this.queues[queueName].process(metadata.name, concurrency, async (j, d) => {
            try {
                await Promise.resolve(task.call(ctrl, j, d));
            } catch (err) {
                d(err);
            }
        });
        this.tasks[metadata.name] = metadata;
    }

    private createQueue(queueName: string): kue.Queue {
        let queue: kue.Queue = kue.createQueue(this.redisConfig);
        queue.setMaxListeners(0);

        if (!this.debugActive && 
            process.env.KUE_DEBUG && 
            queueName == KueService.DEFAULT_QUEUE_NAME) {
            this.debugActive = true;
            this.bindDebugQueueEvents(queue);
        }

        return queue;
    }

    private bindDebugQueueEvents(queue: kue.Queue) {
        for (let event of KueService.DEBUG_EVENTS) {
            queue.on(event, (id) => {
                kue.Job.get(id, (err, job: kue.Job) => {
                    if (job) this.debugLog(job, event);
                });
            });
        }

        queue.on('job error', (id, error) => {
            kue.Job.get(id, (err, job: kue.Job) => {
                if (job) this.debugLog(job, 'job error', error);
            });
        });
    }

    private debugLog(job: kue.Job, event: string, err?) {
        let log: string = `Task ${job.type} ${event} `;
        log += `${(err) ? '\n' + FancyLoggerService.clc.red(err) : ''}`;
        this.fancyLogger.info('KueModule', log, 'TaskRunner');
    }

    createJob(task, data: Object): kue.Job {
        let metadata: TaskMetadata = this.tasks[task.name];
        let queueName: string = metadata.queue || KueService.DEFAULT_QUEUE_NAME;
        let queue: kue.Queue = this.queues[queueName];

        let job: kue.Job = queue.create(metadata.name, data);
        if (metadata.ttl) job.ttl(metadata.ttl);
        if (metadata.attempts) job.attempts(metadata.attempts);
        if (metadata.backoff) job.backoff(metadata.backoff);
        return job;
    }
    
    getJob(id: string): Promise<kue.Job> {
      return new Promise((resolve, reject) => {
          kue.Job.get(id, (err, job: kue.Job) => {
              if (err) {
                  return reject(err);
              }
              return resolve(job);
          });
      });
    }
}
