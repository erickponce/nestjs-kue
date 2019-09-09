import {Injectable} from '@nestjs/common';
import {TaskMetadata} from '../../utils/task.decorator';
import {FancyLoggerService} from '../fancy-logger/fancy-logger.service';
import {Controller} from "@nestjs/common/interfaces";
import * as kue from 'kue';
import * as Redis from 'ioredis';

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

    public queues: { [name: string]: kue.Queue } = {};
    private tasks: { [name: string]: TaskMetadata } = {};
    private debugActive: boolean = false;
    private redisConfig = {
        prefix: process.env.KUE_REDIS_PREFIX,
        redis: null,
    };
    private ddTracer;
    private ddServiceName: string;
    private autoStartProcessing: boolean;
    private sentinelActive: any;

    constructor(
        private readonly fancyLogger: FancyLoggerService,
    ) {
        this.autoStartProcessing = (eval(process.env.KUE_START_PROCESSING) || false);
        this.sentinelActive = (eval(process.env.KUE_REDIS_SENTINEL) || false);

        this.queues[KueService.DEFAULT_QUEUE_NAME] = !this.sentinelActive ? this.redisConfigForQueue() : this.sentinelConfigForQueue();


        if ((eval(process.env.KUE_UI_ENABLED) || false)) {
            const uiPort: number = parseInt(process.env.KUE_UI_PORT, null) || 3050;
            kue.app.listen(uiPort, '0.0.0.0',);
            this.fancyLogger.info('KueModule', `UI started on port ${uiPort}`, 'UI');
        }
    }


    sentinelConfigForQueue() {
        if (process.env.KUE_REDIS_SENTINEL_MASTER === undefined || process.env.KUE_REDIS_SENTINEL_PORT === undefined || process.env.KUE_REDIS_SENTINEL_HOST === undefined) {
            this.fancyLogger.info('KueModule', `A config env is missing for redis sentinel`);
            return this.redisConfigForQueue()
        }
        const masterName = process.env.KUE_REDIS_SENTINEL_MASTER, sentinelOpts = {},
            sentinelHost = process.env.KUE_REDIS_SENTINEL_HOST, sentinelPort = process.env.KUE_REDIS_SENTINEL_PORT.split(',').map(e => parseInt(e));;

        const sentinelHostMap = sentinelHost.split(',').map((e, i) => {
            return {
                host: e,
                port: sentinelPort[i]
            }
        });

        const config = {
            redis: {
                createClientFactory: function () {
                    return new Redis({
                        sentinels: sentinelHostMap,
                        name: masterName
                    });
                }
            }
        };
        return this.createQueue(KueService.DEFAULT_QUEUE_NAME, config);
    }

    redisConfigForQueue() {
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

        return this.createQueue(KueService.DEFAULT_QUEUE_NAME, this.redisConfig);
    }

    setDDTracer(ddTracer) {
        this.ddTracer = ddTracer;
        this.ddServiceName = `${this.ddTracer._tracer._service}-kue`;
    }

    registerTask(task: (job, done) => void, metadata: TaskMetadata, ctrl: Controller) {
        let queueName: string = metadata.queue || KueService.DEFAULT_QUEUE_NAME;
        let concurrency: number = metadata.concurrency || KueService.DEFAULT_CONCURRENCY;
        if (!this.queues[queueName]) {
            this.queues[queueName] = this.createQueue(queueName, this.redisConfig);
        }
        if (this.autoStartProcessing) {
            this.queues[queueName].process(metadata.name, concurrency, async (j, d) => {
                let span;

                try {
                    if (!this.ddTracer) {
                        await Promise.resolve(task.call(ctrl, j, d));
                    } else {
                        span = this.ddTracer.startSpan('worker.task');
                        span.addTags({
                            'resource.name': metadata.name,
                            'service.name': this.ddServiceName,
                        });

                        await this.ddTracer.scope().activate(span, () => {
                            return task.call(ctrl, j, d);
                        });
                    }
                } catch (err) {
                    if (span) {
                        span.addTags({
                            'error.type': err.name,
                            'error.msg': err.message,
                            'error.stack': err.stack
                        });
                    }
                    d(err);
                } finally {
                    if (span) {
                        if (j._error === 'TTL exceeded') {
                            span.addTags({
                                'error.type': j._error,
                                'error.msg': `Task execution time exceeded TTL of ${j._ttl} milliseconds`,
                            });
                        }
                        span.finish();
                    }
                }
            });
        }
        this.tasks[metadata.name] = metadata;
    }

    private createQueue(queueName: string, config): kue.Queue {
        let queue: kue.Queue = kue.createQueue(config);
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
            kue.Job.get(parseInt(id, null), (err, job: kue.Job) => {
                if (err) {
                    return reject(err);
                }
                return resolve(job);
            });
        });
    }
}
